import { Message, Provider } from "../types.ts";

export type Compaction = {
  summary: string;
  keep: number;
  before: number;
  after: number;
};

const SUMMARY_PREFIX = "[Summary of the earlier conversation]\n";
const KEEP_RECENT = 6; // messages kept as they are
const THRESHOLD = 0.75; // compact when the context is this full

const SUMMARY_PROMPT = `Summarize the conversation below so the same coding agent can continue the work without the original messages.
Keep exact file paths, commands and error messages. Use these sections:

## Goal
## Done so far
## Files read or changed
## Decisions and constraints
## Open issues and next steps

If the conversation starts with an earlier summary, carry its important content forward.

CONVERSATION:
`;

export function estimateTokens(messages: Message[]): number {
  let chars = 0;
  for (const msg of messages) {
    if (typeof msg.content === "string")
      // User & ToolResult
      chars += msg.content.length;
    else
      // Assistant
      for (const c of msg.content) {
        if (c.type === "text") chars += c.text.length;
        else chars += JSON.stringify(c.arguments).length;
      }
  }
  return Math.ceil(chars / 4);
}

// Till last assistant we know from usage. But token messages after last assistant is not known like toolResult and user. (So it finds all tokens from start to last message)
export function currentTokens(messages: Message[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant")
      return (
        m.usage.input + m.usage.output + estimateTokens(messages.slice(i + 1))
      );
  }
  return estimateTokens(messages);
}

// So Adding summary and also making sure that compaction doesnt happen before next assistant msg by making all values of assistant usage as 0
export function rebuild(summary: string, recent: Message[]): Message[] {
  const fresh = recent.map(
    (m): Message =>
      m.role === "assistant" ? { ...m, usage: { input: 0, output: 0 } } : m,
  );
  return [{ role: "user", content: SUMMARY_PREFIX + summary }, ...fresh];
}

export function renderMessages(messages: Message[]): string {
  let renderedMsgs = "";
  for (const msg of messages) {
    if (msg.role === "user") renderedMsgs += `USER: ${msg.content}\n`;
    else if (msg.role === "toolResult")
      renderedMsgs += `TOOL RESULT (${msg.toolName}${msg.isError ? ", error" : ""}): ${msg.content}\n`;
    else {
      let parts = "";
      for (const content of msg.content) {
        parts +=
          (content.type === "text"
            ? content.text
            : `[Called ${JSON.stringify(content.arguments)}]`) + " ";
      }
      renderedMsgs += `ASSISTANT: ${parts} \n`;
    }
  }
  return renderedMsgs;
}

export async function summarize(
  provider: Provider,
  model: string,
  old: Message[],
): Promise<string> {
  let text = "";

  for await (const e of provider.stream({
    messages: [{ role: "user", content: SUMMARY_PROMPT + renderMessages(old) }],
    model,
    system: "You write precise summaries of coding-agent conversations.",
  })) {
    if (e.type === "text_delta") text += e.delta;
  }

  return text.trim();
}

export async function compactIfNeeded(
  messages: Message[],
  contextLimit: number,
  provider: Provider,
  model: string,
): Promise<Compaction | null> {
  if (currentTokens(messages) <= contextLimit * THRESHOLD) return null;

  // Never keeping messages in memory from toolResult as start point
  let split = messages.length - KEEP_RECENT;
  while (split > 0 && messages[split].role === "toolResult") split--;
  if (split <= 0) return null;

  const summary = await summarize(provider, model, messages.slice(0, split));
  if (!summary) return null;

  const recent = messages.slice(split);
  const before = messages.length;
  messages.splice(0, messages.length, ...rebuild(summary, recent));

  return {
    summary,
    keep: recent.length,
    before,
    after: messages.length,
  };
}
