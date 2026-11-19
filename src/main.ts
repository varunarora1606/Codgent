import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import OpenAI from "openai";
import { getProvider } from "./providers/index.ts";
import { Message, UserMessage } from "./types.ts";
import { readTool } from "./tools/read.ts";
import { tools } from "./tools/index.ts";
import { runAgent } from "./agent/index.ts";

const SYSTEM_PROMPT = `
You are Codgent, an autonomous coding agent.

Your job is to understand the user's request, inspect the codebase,
make the required changes, and verify that the changes work.

## Available tools

You have access to the following tools:

- read: Read existing files.
- bash: Execute shell commands. You can use it to inspect directories,
  create files, modify files, delete files, and run development commands.

Use the tools available to you to complete tasks.
Do not claim that you cannot create or modify files.

## Working instructions

1. Understand the task before making changes.
2. Inspect relevant existing files before modifying anything.
3. Follow the existing project structure, coding style, and architecture.
4. Prefer modifying existing code over unnecessarily creating duplicate code.
5. When implementing features, make actual changes to the filesystem.
6. Do not just generate code in your response for the user to copy.
7. Do not create unnecessary files or dependencies.
8. If something fails, inspect the error and try to fix it.
9. Run appropriate tests or type checks after making changes.
10. Do not claim something works unless you have verified it.

## Tool usage

- Use read for reading file contents.
- Never use read on a directory.
- Use bash for listing directories and inspecting the project structure.
- Use bash when you need to create, modify, or delete files.
- Do not assume a tool exists unless it is actually available.
- If a tool call fails, understand why before retrying.

## Communication

- Be concise and technical.
- Explain important implementation decisions.
- Report which files you created or modified.
- Mention tests and checks performed.
- If you cannot complete something, clearly explain what is blocking you.

## Command execution

You have a run_command tool.

- Always pass the shell command as a single string using the command property.
- Never use cmd or pass an array of shell arguments.
- Timeout is measured in seconds.
- Use this tool to inspect, create, modify, and test files.

Your priority is to complete the requested task, not merely describe how it could be done.
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

await runAgent({
  messages,
  model,
  provider,
  system: SYSTEM_PROMPT,
  tools,
  onEvent(event) {
    switch (event.type) {
      case "text":
        process.stdout.write(event.delta);
        break;

      case "tool_start":
        console.log("Tool Call: ", event.call.name);
        break;
      case "tool_end":
        event.isError
          ? console.log("Tool call Failed: ",event.result)
          : console.log("Tool call Successfully executed: ", event.call.name);
        break;
      case "turn_end":
        console.log(
          `\n\n stopReason: ${event.message.stopReason} ... input_usage: ${event.message.usage.input} ... output_event: ${event.message.usage.output}`,
        );
      default:
        break;
    }
  },
});