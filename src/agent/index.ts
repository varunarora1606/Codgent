import { ToolResult } from "../tools/types.ts";
import {
  AssistantMessage,
  Message,
} from "../types.ts";
import { compactIfNeeded } from "./compaction.ts";
import { AgentOptions } from "./types.ts";

export async function runAgent(opts: AgentOptions) {
  const {
    provider,
    model,
    messages,
    system,
    tools,
    contextLimit,
    onEvent,
    canUseTool,
  } = opts;
  const maxTurn = opts.maxTurns ?? 20;

  for (let i = 1; i <= maxTurn; i++) {
    let assistant: AssistantMessage | undefined;

    const compaction = await compactIfNeeded(
      messages,
      contextLimit,
      provider,
      model,
    );
    if (compaction) {
      await onEvent({ type: "compaction", compaction });
    }

    const push = async (message: Message) => {
      messages.push(message);
      await onEvent({ type: "message", message });
    };

    // STREAMING START: Calling LLM and streaming response
    for await (const event of provider.stream({
      messages,
      model,
      system,
      tools,
    })) {
      if (event.type === "text_delta")
        await onEvent({ type: "text", delta: event.delta });
      else assistant = event.message;
    }
    // STREAMING END

    if (!assistant) {
      throw new Error("Provider did not returned an assistant message");
    }
    await push(assistant);
    await onEvent({ type: "turn_end", message: assistant });

    if (assistant.stopReason !== "tool_calls") return;

    //TOOL CALL START: Calling tools and returning toolResult
    for (const call of assistant.content) {
      if (call.type !== "tool_call") continue;
      await onEvent({ type: "tool_start", call });
      let result: ToolResult = { isError: false, output: "" };
      // let isError = false;

      try {
        const tool = tools?.find((t) => t.name === call.name);
        if (!tool) throw Error(`${call.name} tool is not available`);
        if (!tool.readOnly) {
          const userToolResponse = await canUseTool(tool, call.arguments);
          if (userToolResponse.behavior === "deny")
            throw new Error(userToolResponse.message);
        }
        result = await tool.execute(call.arguments);
        if (result.isError) throw new Error(result.output);
      } catch (error) {
        result.output = error instanceof Error ? error.message : String(error);
        result.isError = true;
      }
      await onEvent({
        type: "tool_end",
        call,
        result: result.output,
        isError: result.isError,
      });
      await push({
        role: "toolResult",
        content: result.output,
        toolCallId: call.id,
        toolName: call.name,
        isError: result.isError,
      });
    }
    //TOOL CALL ENDED
  }

  throw new Error(`Maxturns ka ghee khtm`);
}
