import {
  AssistantMessage,
  Message,
  Provider,
  Tool,
  ToolCallBlock,
} from "../types.ts";
import { compactIfNeeded, Compaction } from "./compaction.ts";

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "message"; message: Message }
  | { type: "turn_end"; message: AssistantMessage }
  | { type: "tool_start"; call: ToolCallBlock }
  | { type: "tool_end"; call: ToolCallBlock; result: string; isError: boolean }
  | ({ type: "compaction", compaction: Compaction });

export type PermissionResult =
  | { behavior: "deny"; message: string }
  | { behavior: "allow" };

export type AgentOptions = {
  provider: Provider;
  model: string;
  system?: string;
  messages: Message[];
  tools?: Tool[];
  maxTurns?: number;
  contextLimit: number;
  onEvent: (e: AgentEvent) => Promise<void>;
  canUseTool: (
    t: Tool,
    args: Record<string, unknown>,
  ) => Promise<PermissionResult>;
};

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
      let result: string;
      let isError = false;

      try {
        const tool = tools?.find((t) => t.name === call.name);
        if (!tool) throw Error(`${call.name} tool is not available`);
        if (!tool.readOnly) {
          const userToolResponse = await canUseTool(tool, call.arguments);
          if (userToolResponse.behavior === "deny")
            throw new Error(userToolResponse.message);
        }
        result = await tool.execute(call.arguments);
      } catch (error) {
        result = `Error occured during tool call of ${call.name}: ${error}`;
        isError = true;
      }
      await onEvent({ type: "tool_end", call, result, isError });
      await push({
        role: "toolResult",
        content: result,
        toolCallId: call.id,
        toolName: call.name,
        isError,
      });
    }
    //TOOL CALL ENDED
  }

  throw new Error(`Maxturns ka ghee khtm`);
}
