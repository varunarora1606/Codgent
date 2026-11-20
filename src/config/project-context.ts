import { readFile } from "node:fs/promises";
import { join } from "node:path";

const FILES = ["AGENTS.md", "CLAUDE.md"];
const MAX_CHAR = 20000;

export async function loadProjectContext(cwd: string): Promise<string | undefined> {
  for (const file of FILES) {
    let text: string;
    try {
      text = await readFile(join(cwd, file), "utf-8");
    } catch (error) {
      continue;
    }
    text = text.trim();
    if (!text) continue;
    if (text.length > MAX_CHAR) {
      text = `${text.slice(0, MAX_CHAR)}\n[${file} truncated at ${MAX_CHAR} characters]`;
    }
    return `Project instruction (from ${file}):\n${text}`;
  }
  return undefined;
}
