import { Interface } from "node:readline/promises";
import { PermissionResult } from "../agent/index.ts";
import { Tool } from "../types.ts";

function describe(tool: Tool, args: Record<string, unknown>) {
  switch (tool.name) {
    case "bash":
      const desc = args.description ? `${args.description}\n` : "";
      return `${desc} $ ${String(args.command).slice(0, 500)}`;

    default:
      break;
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
