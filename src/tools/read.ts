import { Tool } from "../types.ts";
import { ToolResult } from "./types.ts";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const readTool: Tool = {
  name: "read",
  description: "Read a file and returns its contents",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file, relative to the current folder",
      },
    },
    required: ["path"],
  },

  readOnly: true,

  async execute(args): Promise<ToolResult> {
    return {
      output: await readFile(resolve(process.cwd(), String(args.path)), "utf-8"),
      isError: false,
    };
  },
};
