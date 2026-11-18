import OpenAI from "openai";
import {
  Provider,
  StopReason,
  StreamEvents,
  StreamOptions,
  Usage,
} from "../types.ts";

export function createOpenAiCompat(
  name: string,
  baseURL: string,
  apiKey: string,
  defaultModel: string,
): Provider {
  const client = new OpenAI({
    baseURL,
    apiKey,
  });

  return {
    name,
    defaultModel,
    async *stream(opts: StreamOptions) {
      const stream = await client.chat.completions.create({
        model: opts.model,
        messages: opts.messages,
        stream: true,
        stream_options: { include_usage: true },
      });

      let text = "";
      let usage: Usage = { input: 0, output: 0 };
      let stopReason: StopReason = "stop";

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.delta?.content) {
          text += choice.delta.content;
          yield { type: "text_delta", delta: choice.delta.content };
        }
        if (choice?.finish_reason === "length") {
          stopReason = "length";
        }
        if (chunk.usage) {
          usage = {
            input: chunk.usage.prompt_tokens,
            output: chunk.usage.completion_tokens,
          };
        }
      }
      yield {
        type: "done",
        message: { content: text, role: "assistant", stopReason, usage },
      };
    },
  };
}
