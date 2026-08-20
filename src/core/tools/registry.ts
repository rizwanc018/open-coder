import { getBuiltinTools } from ".";
import type { Config } from "../config/config";
import { errorMessage } from "../utils/error";
import { err, toToolSchema, type AnyTool, type ToolContext, type ToolResult, type ToolSchema } from "./types";

export interface InvokeOptions {
    cwd: string;
    signal?: AbortSignal;
    config: Config;
}

export class ToolRegistry {
    private readonly _tools = new Map<string, AnyTool>();

    constructor(private readonly config: Config) {}

    register(tool: AnyTool): void {
        this._tools.set(tool.name, tool);
    }

    unregister(name: string): boolean {
        return this._tools.delete(name);
    }

    getTools(): AnyTool[] {
        const all = [...this._tools.values()];
        const allowed = this.config.allowedTools;

        if (!allowed) return all;

        const allowSet = new Set(allowed);
        return all.filter((tool) => allowSet.has(tool.name));
    }

    getSchemas(): ToolSchema[] {
        return this.getTools().map(toToolSchema);
    }

    get(name: string): AnyTool | undefined {
        return this._tools.get(name);
    }

    async invoke(
        name: string,
        rawParams: Record<string, unknown>,
        options: InvokeOptions,
    ): Promise<ToolResult> {
        const { cwd, signal, config } = options;

        const tool = this.get(name);
        if (!tool) {
            return err(`Unknown tool: ${name}`, { metadata: { toolName: name } });
        }

        const parsed = tool.schema.safeParse(rawParams);
        if (!parsed.success) {
            const issues = parsed.error.issues.map((issue) => {
                const path = issue.path.map(String).join(".");
                return path ? `Parameter '${path}': ${issue.message}` : issue.message;
            });

            return err(`Invalid parameters: ${issues.join("; ")}`, {
                metadata: { toolName: name, validationErrors: issues },
            });
        }

        const params = parsed.data as Record<string, unknown>;
        const ctx: ToolContext = { cwd, signal, config };

        let result: ToolResult;
        try {
            result = await tool.execute(params, ctx);
        } catch (error) {
            result = err(`Internal error: ${errorMessage(error)}`, {
                metadata: { toolName: name },
            });
        }

        return result;
    }
}

export const createToolDefaultRegistry = (
    config: Config,
): {
    toolRegistry: ToolRegistry;
} => {
    const toolRegistry = new ToolRegistry(config);

    for (const tool of getBuiltinTools()) {
        toolRegistry.register(tool);
    }

    return { toolRegistry };
};
