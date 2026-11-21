import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { getProvider } from "./providers/index.ts";
import { Message } from "./types.ts";
import { tools } from "./tools/index.ts";
import { AgentEvent, runAgent } from "./agent/index.ts";
import { createInterface } from "node:readline/promises";
import { buildSystemPrompt } from "./config/system-prompt.ts";
import { makeToolAsk } from "./permissions/prompt.ts";
import {
  createSession,
  listSessions,
  listSessionSummaries,
  loadSession,
  SaveCompaction,
  saveMessage,
} from "./session/store.ts";
import { Session } from "./session/types.ts";

// load the .env next to the code, so mypi works from any folder
config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});

const { values } = parseArgs({
  options: {
    prompt: { type: "string", short: "p" },
    provider: { type: "string", default: "openRouter" },
    model: { type: "string" },
    yolo: { type: "boolean", default: false },
    resume: { type: "boolean", short: "r" },
    session: { type: "string" },
    "list-sessions": { type: "boolean" },
    "context-limit": { type: "string" },
  },
});

const contextLimit = Number(values["context-limit"] ?? 100_000);
if (!Number.isFinite(contextLimit) || contextLimit <= 0) {
  console.error("Context limit must be a positive number.");
  process.exit(1)
}

if (values["list-sessions"]) {
  await printSessionSummaries();
  process.exit(0);
}


const system = await buildSystemPrompt();

const provider = getProvider(values.provider);
const model = values.model ?? provider.defaultModel;

const messages: Message[] = [];

let session: Session | null;

if (values.session || values.resume) {
  const sessionId = values.session ?? (await listSessions())[0].sessionId;
  if (!sessionId) {
    console.error("No matching session in this folder.");
    process.exit(1);
  }

  const found = await loadSession(sessionId);
  if (!found) {
    console.error("No matching session in this folder.");
    process.exit(1);
  }
  session = found;
  messages.push(...session.messages);
  console.error(`(resumed ${session.id}, ${messages.length} messages)`);
} else {
  session = await createSession(model, provider.name);
}

const r1 = createInterface({
  input: process.stdin,
  output: process.stderr,
});

const yolo = values.yolo;

const canUseTool = yolo
  ? async () => ({ behavior: "allow" as const })
  : makeToolAsk(r1);

const onEvent = async (event: AgentEvent) => {
  switch (event.type) {
    case "text":
      process.stdout.write(event.delta);
      break;
    case "tool_start":
      console.log("Tool Call: ", event.call.name);
      break;
    case "tool_end":
      event.isError
        ? console.log("Tool call Failed: ", event.result)
        : console.log("Tool call Successfully executed: ", event.call.name);
      break;
    case "message":
      if (!session) session = await createSession(model, provider.name);
      await saveMessage(session.id, event.message);
      break;
    case "turn_end":
      console.log(
        `\n\n stopReason: ${event.message.stopReason} ... input_usage: ${event.message.usage.input} ... output_event: ${event.message.usage.output}`,
      );
      break;
    case "compaction":
      if (!session) session = await createSession(model, provider.name);
      await SaveCompaction(session.id, event.compaction);
      console.error(
        `\n[compacted: ${event.compaction.before} → ${event.compaction.after} messages]`,
      );
    default:
      break;
  }
};

const runTurn = async (prompt: string) => {
  const userMessage: Message = { role: "user", content: prompt };
  messages.push(userMessage);
  session = session ?? (await createSession(model, provider.name));
  await saveMessage(session.id, userMessage);
  await runAgent({
    messages,
    model,
    provider,
    system,
    tools,
    contextLimit,
    onEvent,
    canUseTool,
  });
};

// Print(one-shot) mode: codgent -p "do X"
if (values.prompt) {
  try {
    await runTurn(values.prompt);
  } catch (error) {
    console.error("Agent failed:", error);
    process.exitCode = 1;
  }
} else {
  // Interactive mode: just run `codgent` (Keep the conversation persistant)
  console.error("codgent  (type /help for commands, /exit or Ctrl-D to quit)");
  while (true) {
    let prompt: string;
    try {
      prompt = (await r1.question(`\n> `)).trim();
    } catch (error) {
      break;
    }

    if (!prompt) continue;
    if (prompt === "/exit") break;
    if (prompt === "/help") {
      console.error(`
/help    show available commands
/clear   start a new session
/exit    quit Codgent

Session options:
-r, --resume         resume the latest session
--session <id>       resume a specific session
--list-sessions      list saved sessions
`);
      continue;
    }

    if (prompt === "/clear") {
      messages.length = 0;
      session = null;
      console.error("(history cleared)");
      continue;
    }

    try {
      await runTurn(prompt);
    } catch (error) {
      console.error("Agent failed:", error);
    }
  }
}
r1.close();

async function printSessionSummaries() {
  const sessionSummaries = await listSessionSummaries();
  if (sessionSummaries.length === 0) {
    console.log("\nNo saved sessions yet.\n");
    return;
  }

  console.log("\nSaved sessions (last modified first):\n");
  for (const s of sessionSummaries) {
    const when = timeAgo(s.mTimeMs);
    console.log(` id: ${s.id}`);
    console.log(
      `     ${when} · ${s.provider}/${s.model} · ${s.messageCount} messages`,
    );
    console.log(`     First Prompt: ${s.firstPrompt}\n`);
  }
  console.log("Resume with: cogent --session <id>\n");
}

// Just for beauty
function timeAgo(mtime: number): string {
  const diff = Date.now() - mtime;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} days ago`;
  if (hours > 0) return `${hours} hours ago`;
  if (minutes > 0) return `${minutes} minutes ago`;
  return "Just now";
}
