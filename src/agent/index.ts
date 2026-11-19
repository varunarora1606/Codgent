import {
  AssistantMessage,
  Message,
  Provider,
  Tool,
  ToolCallBlock,
} from "../types.ts";

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "message"; message: Message }
  | { type: "turn_end"; message: AssistantMessage }
  | { type: "tool_start"; call: ToolCallBlock }
  | { type: "tool_end"; call: ToolCallBlock; result: string; isError: boolean };

export type AgentOptions = {
  provider: Provider;
  model: string;
  system?: string;
  messages: Message[];
  tools?: Tool[];
  maxTurns?: number;
  onEvent: (e: AgentEvent) => void;
};

export async function runAgent(opts: AgentOptions) {
  const { provider, model, messages, system, tools, onEvent } = opts;
  const maxTurn = opts.maxTurns ?? 20;

  for (let i = 1; i <= maxTurn; i++) {
    let assistant: AssistantMessage | undefined;
    const push = (message: Message) => {
      messages.push(message);
      onEvent({ type: "message", message });
    };

    // STREAMING START: Calling LLM and streaming response
    for await (const event of provider.stream({
      messages,
      model,
      system,
      tools,
    })) {
      if (event.type === "text_delta")
        onEvent({ type: "text", delta: event.delta });
      else assistant = event.message;
    }
    // STREAMING END

    if (!assistant) {
      return console.log("Assistant message nhi hai");
    }
    push(assistant);
    onEvent({ type: "turn_end", message: assistant });

    if (assistant.stopReason !== "tool_calls") return;

    //TOOL CALL START: Calling tools and returning toolResult
    for (const call of assistant.content) {
      if (call.type !== "tool_call") continue;
      onEvent({ type: "tool_start", call });
      let result: string;
      let isError = false;

      try {
        const tool = tools?.find((t) => t.name === call.name);
        if (!tool) throw Error(`${call.name} tool is not available`);
        result = await tool.execute(call.arguments);
      } catch (error) {
        result = `Error occured during tool call of ${call.name}: ${error}`;
        isError = true;
      }
      onEvent({ type: "tool_end", call, result, isError });
      push({
        role: "toolResult",
        content: result,
        toolCallId: call.id,
        toolName: call.name,
        isError,
      });
    }
    //TOOL CALL ENDED
  }
  throw new Error(`Maxturns ka ghee khtm`)
}
