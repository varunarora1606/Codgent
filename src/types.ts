export type Usage = { input: number; output: number };
export type StopReason = "length" | "stop" | "tool_calls";

export type TextBlock = { type: "text"; text: string };
export type ToolCallBlock = {
  type: "tool_call";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};
export type ContentBlock = TextBlock | ToolCallBlock;

export type UserMessage = { role: "user"; content: string };
export type AssistantMessage = {
  role: "assistant";
  content: ContentBlock[];
  usage: Usage;
  stopReason: StopReason;
};

export type ToolResultMessage = {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: string;
  isError: boolean;
};
export type Message = UserMessage | AssistantMessage | ToolResultMessage;

export type StreamEvents =
  | { type: "text_delta"; delta: string }
  | { type: "done"; message: AssistantMessage }
  // | { type: "tool_use"; message: ToolResultMessage };

export type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type StreamOptions = {
  messages: Message[];
  model: string;
  system?: string;
  tools?: ToolSpec[];
};

export interface Provider {
  name: string;
  defaultModel: string;
  stream(opts: StreamOptions): AsyncIterable<StreamEvents>;
}

// export type ReadToolExecuteArg = {
//   path: string
// }

export type Tool = ToolSpec & {
  execute(args: Record<string, unknown>): Promise<string>;
};
