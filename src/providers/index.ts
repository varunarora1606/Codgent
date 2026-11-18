import { Provider } from "../types.ts";
import { createOpenAiCompat } from "./openai-compat.ts";

const providers: Record<string, () => Provider> = {
  groq: () =>
    createOpenAiCompat(
      "groq",
      "https://api.groq.com/openai/v1",
      process.env.GROQ_API_KEY!,
      "openai/gpt-oss-20b",
    ),
  anthropic: () =>
    createOpenAiCompat(
      "anthropic-openai",
      "https://api.anthropic.com/v1/",
      process.env.ANTHROPIC_API_KEY!,
      "claude-sonnet-5",
      
    ),
};

export function getProvider(name: string): Provider {
  const create = providers[name];

  if (!create) {
    throw new Error("Incorrect Model Provider");
  }

  return create();
}
