import { AssistantMessage, Message, Provider, Tool, ToolCallBlock } from "../types.ts";
import { Compaction } from "./compaction.ts";

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "message"; message: Message }
  | { type: "turn_end"; message: AssistantMessage }
  | { type: "tool_start"; call: ToolCallBlock }
  | { type: "tool_end"; call: ToolCallBlock; result: string; isError: boolean }
  | { type: "compaction"; compaction: Compaction };

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
