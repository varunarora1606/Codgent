import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  Session,
  SessionEntry,
  SessionInfoEntry,
  SessionSummary,
} from "./types.ts";
import { Message } from "../types.ts";
import { Compaction, rebuild } from "../agent/compaction.ts";

// Helper Fxns
function getSessionDir(): string {
  return join(process.cwd(), ".codgent", "sessions");
}

function getSessionPath(sessionId: string): string {
  return join(getSessionDir(), `${sessionId}.jsonl`);
}

async function ensureSession(): Promise<void> {
  await mkdir(getSessionDir(), { recursive: true });
}

async function appendEntry(
  sessionId: string,
  entry: SessionEntry,
): Promise<void> {
  await ensureSession();
  const line = `${JSON.stringify(entry)}\n`;
  await appendFile(getSessionPath(sessionId), line);
}

// Export Fxns
export async function createSession(
  model: string,
  provider: string,
): Promise<Session> {
  await ensureSession();
  const sessionId = `${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`;

  const header: SessionInfoEntry = {
    type: "session_info",
    id: sessionId,
    provider,
    model,
    createdAt: new Date().toISOString(),
  };
  await appendEntry(sessionId, header);

  return {
    id: sessionId,
    provider,
    model,
    createdAt: new Date().toISOString(),
    messages: [],
  };
}

export async function saveMessage(
  sessionId: string,
  message: Message,
): Promise<void> {
  await appendEntry(sessionId, { type: "message", message });
}

export async function saveMessages(
  sessionId: string,
  messages: Message[],
): Promise<void> {
  for (const message of messages) await saveMessage(sessionId, message);
}

export async function SaveCompaction(
  sessionId: string,
  compaction: Compaction,
): Promise<void> {
  await appendEntry(sessionId, {
    type: "compaction",
    summary: compaction.summary,
    keep: compaction.keep,
  });
}

export async function loadSession(sessionId: string): Promise<Session | null> {
  if (!existsSync(getSessionPath(sessionId))) return null;

  const raw = await readFile(getSessionPath(sessionId), "utf-8");
  const entries = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SessionEntry);

  const sessionInfoEntry = entries.find((e) => e.type === "session_info");
  if (!sessionInfoEntry) return null;

  let messages: Message[] = [];
  for (const entry of entries) {
    if (entry.type === "message") messages.push(entry.message);
    if (entry.type === "compaction")
      messages = rebuild(entry.summary, messages.slice(-entry.keep));
  }

  return {
    id: sessionInfoEntry.id,
    createdAt: sessionInfoEntry.createdAt,
    model: sessionInfoEntry.model,
    provider: sessionInfoEntry.provider,
    messages,
  };
}

export async function listSessions(): Promise<
  { sessionId: string; mTimeMs: number }[]
> {
  const dir = getSessionDir();
  const files = (await readdir(dir))
    .filter((file) => file.endsWith(".jsonl"))
    .map((file) => file.replace(".jsonl", ""));
  const fileInfo: { sessionId: string; mTimeMs: number }[] = [];
  for (const file of files) {
    const mTimeMs = (await stat(getSessionPath(file))).mtimeMs;
    fileInfo.push({ sessionId: file, mTimeMs });
  }
  return fileInfo.sort((a, b) => b.mTimeMs - a.mTimeMs);
}

export async function listSessionSummaries(): Promise<SessionSummary[]> {
  const fileInfo = await listSessions();
  const summaries: SessionSummary[] = [];

  for (const f of fileInfo) {
    const session = await loadSession(f.sessionId);
    if (!session) continue;

    const first = session.messages.find((m) => m.role === "user");
    const firstText = first ? first.content : "";

    summaries.push({
      id: session.id,
      createdAt: session.createdAt,
      mTimeMs: f.mTimeMs,
      model: session.model,
      provider: session.provider,
      messageCount: session.messages.length,
      firstPrompt: firstText.replace(/\s+/g, " ").slice(0, 60) || "(no prompt)",
    });
  }
  return summaries;
}
