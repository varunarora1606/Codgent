import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import OpenAI from "openai";
import { getProvider } from "./providers/index.ts";
import { Message, UserMessage } from "./types.ts";
import { readTool } from "./tools/read.ts";

const tools = [readTool];
// Update this, as it is implemented only for readTool
const SYSTEM_PROMPT = `
  You are a coding assistant with access to filesystem tools.

Rules:
1. Use tools only when necessary to fulfill the user's request.
2. If the user specifies a file path, directly use the read tool.
3. Never use the read tool to inspect directories.
4. If a file contains a reference to another file, extract that path
   and use the read tool to read the referenced file.
5. Never assume that a directory can be read using the read tool.
6. If an operation requires an unavailable tool, explain the limitation.
`;

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

async function callModel() {
  for await (const event of provider.stream({
    model,
    messages,
    tools,
    system: SYSTEM_PROMPT,
  })) {
    if (event.type === "text_delta") {
      process.stdout.write(event.delta);
    } else {
      console.log(
        `\n\n stopReason: ${event.message.stopReason} ... input_usage: ${event.message.usage.input} ... output_event: ${event.message.usage.output}`,
      );
      return event.message;
    }
  }
  throw new Error("stream ended without a done event");
}

while (true) {
  console.dir(messages, { depth: null, colors: true });
  const response = await callModel();

  if (response.stopReason === "stop") break;
  if (response.stopReason === "length") {
    console.log("Model reached token limit");
    break;
  }

  messages.push(response);

  for (const block of response.content) {
    // console.log("block",block);
    if (block.type === "text") continue;
    console.log(block.arguments);
    const result = await readTool.execute(block.arguments);
    console.log(result);
    messages.push({
      role: "toolResult",
      content: result,
      toolCallId: block.id,
      toolName: block.name,
    });
  }
}
