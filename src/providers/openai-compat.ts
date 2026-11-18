import OpenAI from "openai";
import {
  Message,
  Provider,
  StopReason,
  StreamEvents,
  StreamOptions,
  Usage,
} from "../types.ts";
import { FunctionParameters } from "openai/resources";

function toOpenAI(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((m): OpenAI.ChatCompletionMessageParam => {
    if (m.role === "user") return m;
    if (m.role === "assistant") {
      const text = m.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      const toolCall = m.content.filter((b) => b.type === "tool_call");
      return {
        role: "assistant",
        content: text || null,
        tool_calls: toolCall.length
          ? toolCall.map((t) => ({
              id: t.id,
              type: "function" as const,
              function: {
                name: t.name,
                arguments: JSON.stringify(t.arguments),
              },
            }))
          : undefined,
      };
    }
    return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
  });
}

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
      const chat = toOpenAI(opts.messages);
      const stream = await client.chat.completions.create({
        model: opts.model,
        messages: opts.system ? [{role: "system", content: opts.system}, ...chat] : chat,
        tools: opts.tools?.length
          ? opts.tools.map((t) => ({
              type: "function" as const,
              function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              },
            }))
          : undefined,
        stream: true,
        stream_options: { include_usage: true },
      });

      let text = "";
      let toolCalls = new Map<
        number,
        { id: string; name: string; arguments: string }
      >();
      let usage: Usage = { input: 0, output: 0 };
      let stopReason: StopReason = "stop";

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.delta?.content) {
          text += choice.delta.content;
          yield { type: "text_delta", delta: choice.delta.content };
        }
        for (const tc of choice?.delta?.tool_calls ?? []) {
          const existing = toolCalls.get(tc.index) ?? {
            id: "",
            name: "",
            arguments: "",
          };

          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name += tc.function.name;
          if (tc.function?.arguments)
            existing.arguments += tc.function.arguments;

          toolCalls.set(tc.index, existing);
        }
        if (choice?.finish_reason === "tool_calls") {
          stopReason = "tool_calls";
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

      const content = [];

      if (text) {
        content.push({ type: "text" as const, text });
      }

      for (const tc of toolCalls.values()) {
        if (!tc.id || !tc.name) {
          throw new Error("Incomplete tool call");
        }

        // console.log(tc.arguments);
        const args = JSON.parse(tc.arguments);
        // console.log("args", args);
        content.push({
          type: "tool_call" as const,
          id: tc.id,
          name: tc.name,
          arguments: args as Record<string, any>,
        });
      }

      // if (toolCalls.length > 0 && stopReason === "tool_calls") {
      //   // Loop here
      //   if (toolCalls[0].function?.name === "read") {
      //     const args = toolCalls[0].function?.arguments;
      //     const path = JSON.parse(args || "");
      //     // const result = await readTool.execute(path);
      //     yield {
      //       type: "done",
      //       message: {
      //         content: [
      //           {
      //             type: "tool_call",
      //             id: toolCall[0].id || "",
      //             name: toolCalls[0].function.name,
      //             arguments: path,
      //           },
      //         ],
      //         role: "assistant",
      //         stopReason,
      //         usage,
      //       },
      //     };
      //   }
      //   // const result = readTool.execute(toolCall[0].)
      // }
      yield {
        type: "done",
        // Here
        message: {
          content: content,
          role: "assistant",
          stopReason,
          usage,
        },
      };
    },
  };
}
