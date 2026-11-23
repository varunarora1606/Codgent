import { Interface } from "node:readline/promises";
import { Tool } from "../types.ts";
import { PermissionResult } from "../agent/types.ts";

function describe(tool: Tool, args: Record<string, unknown>) {
  const description = tool.description ?? "";

  switch (tool.name) {
    case "Bash": {
      const reason = args.description
        ? `\nReason: ${String(args.description)}`
        : "";

      return `${reason}\nCommand:\n$ ${String(args.command).slice(0, 500)}`;
    }

    case "Edit":
      return (
        `\nFile: ${String(args.file_path)}\n` +
        `Replace: ${String(args.old_string).slice(0, 300)}\n` +
        `With: ${String(args.new_string).slice(0, 300)}`
      );

    case "Write":
      return (
        `\nFile: ${String(args.file_path)}\n` +
        `Content: ${String(args.content).slice(0, 500)}`
      );

    default:
      return description;
  }
}

export const makeToolAsk =
  (r1: Interface) =>
  async (
    tool: Tool,
    args: Record<string, unknown>,
  ): Promise<PermissionResult> => {
    if (!process.stdin.isTTY)
      return {
        behavior: "deny",
        message: "No terminal to ask for permission.",
      };

    console.error(`\nAllow ${tool.name}?\n${describe(tool, args)}`);

    const answer = (await r1.question("[y]es / [n]o > ")).trim().toLowerCase();

    if (answer === "y") return { behavior: "allow" };
    else {
      return {
        behavior: "deny",
        message: "The user denied this action. Ask what they'd like instead.",
      };
    }
  };
