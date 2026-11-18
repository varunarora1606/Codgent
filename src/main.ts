import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import OpenAI from "openai";
import { getProvider } from "./providers/index.ts";
import { Message, UserMessage } from "./types.ts";

// load the .env next to the code, so mypi works from any folder
config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});

const { values } = parseArgs({
  options: {
    prompt: { type: "string", short: "p" },
    provider: { type: "string", default: "groq" },
    model: { type: "string" },
  },
});

if (!values.prompt) {
  console.log(
    `Prompt missing Sir, , codgent -p "prompt" --provider anthropic OR groq`,
  );
  process.exit(1);
}

const provider = getProvider(values.provider);
const model = values.model ?? provider.defaultModel;
const messages: Message[] = [{ role: "user", content: values.prompt }];

for await (const event of provider.stream({ model, messages })) {
  if (event.type === "text_delta") {
    process.stdout.write(event.delta);
  } else {
    console.log(
      `\n\n stopReason: ${event.message.stopReason} ... input_usage: ${event.message.usage.input} ... output_event: ${event.message.usage.output}`,
    );
  }
}

// const client = new OpenAI({
//   apiKey: process.env.GROQ_API_KEY,
//   baseURL: "https://api.groq.com/openai/v1",
// });

// const stream = client.chat.completions.stream({
//     // max_tokens: 1024,
//     messages: [{role: "user", content: values.prompt}],
//     model: values.model,
//     stream: true,
//     stream_options: {include_usage: true}
// })

// let text = ""
// let usage;

// for await (const chunk of stream) {
//     // if (event.choices[0].delta.)
//     const choice = chunk.choices[0]
//     if (choice?.delta?.content?) {
//         text += choice.delta.content
//         process.stdout.write(text)
//     }
//     if (chunk.usage) {
//         usage = chunk.usage
//     }
//     // if (event.type)
// }

// console.log(usage)
