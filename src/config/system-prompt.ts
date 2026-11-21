import { readFile } from "node:fs/promises";
import { join } from "node:path";

const FILES = ["AGENTS.md", "CLAUDE.md"];
const MAX_CHAR = 20000;


export async function buildSystemPrompt(): Promise<string> {
  const base = `You are cogent, an autonomous coding assistant.
  You are running in: ${process.cwd()}
  Today: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
  
  You have access to tools to read files, write files, run shell commands, and search code.
  Use tools proactively to understand the codebase before making changes.
  Always read a file before editing it. Verify your changes work.
  Be concise. No sycophantic openers. No unnecessary explanation.`
  let contextSection = "";
  for (const file of FILES) {
    let text: string;
    try {
      text = await readFile(join(process.cwd(), file), "utf-8");
    } catch (error) {
      continue;
    }
    text = text.trim();
    if (!text) continue;
    if (text.length > MAX_CHAR) {
      text = `${text.slice(0, MAX_CHAR)}\n[${file} truncated at ${MAX_CHAR} characters]`;
    }
    contextSection += `\n\n Project instruction (from ${file}):\n${text}`;
  }
  return base + contextSection;
}
