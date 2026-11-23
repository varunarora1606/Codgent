export interface ToolResult {
	output: string;
	isError: boolean;
}

export function errorResult(err: unknown): ToolResult {
	const msg = err instanceof Error ? err.message : String(err);
	return { output: `Error: ${msg}`, isError: true };
}

export function okResult(output: string): ToolResult {
	return { output, isError: false };
}