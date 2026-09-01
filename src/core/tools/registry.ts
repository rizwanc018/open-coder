import { getBuiltinTools } from ".";
import type { Config } from "../config/config";
import type { HookManager } from "../hooks/hooks";
import type { ApprovalManager } from "../safety/approval";
import { errorMessage } from "../utils/error";
import { createSubagentTool, getDefaultSubagentDefinitions } from "./subAgent";
import {
    err,
    getConfirmation,
    isMutating,
    toToolSchema,
    type AnyTool,
    type ToolContext,
    type ToolResult,
    type ToolSchema,
} from "./types";

export interface InvokeOptions {
    cwd: string;
    config: Config;
    signal?: AbortSignal;
    approvals?: ApprovalManager;
    hooks?: HookManager;
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
        const { cwd, signal, config, approvals, hooks } = options;

        const fail = async (result: ToolResult): Promise<ToolResult> => {
            await hooks?.triggerAfterTool(name, rawParams, result);
            return result;
        };

        const allowed = this.config.allowedTools;

        if (allowed && !allowed.includes(name)) {
            return fail(err(`Tool '${name}' is not available in this context`));
        }

        const tool = this.get(name);
        if (!tool) {
            return fail(err(`Unknown tool: ${name}`, { metadata: { toolName: name } }));
        }

        const parsed = tool.schema.safeParse(rawParams);
        if (!parsed.success) {
            const issues = parsed.error.issues.map((issue) => {
                const path = issue.path.map(String).join(".");
                return path ? `Parameter '${path}': ${issue.message}` : issue.message;
            });

            return fail(
                err(`Invalid parameters: ${issues.join("; ")}`, {
                    metadata: { toolName: name, validationErrors: issues },
                }),
            );
        }

        const params = parsed.data as Record<string, unknown>;
        const ctx: ToolContext = { cwd, signal, config };

        await hooks?.triggerBeforeTool(name, params);

        if (approvals) {
            const confirmation = await getConfirmation(tool, params, ctx);

            if (confirmation) {
                const decision = await approvals.checkApproval({
                    toolName: name,
                    params,
                    isMutating: isMutating(tool, params),
                    affectedPaths: confirmation.affectedPaths ?? [],
                    command: confirmation.command,
                    isDangerous: confirmation.isDangerous ?? false,
                });

                if (decision === "rejected") {
                    return fail(err("Operation rejected by the safety policy"));
                }

                if (decision === "needs_confirmation") {
                    const approved = await approvals.requestConfirmation(confirmation);
                    if (!approved) return fail(err("User rejected the operation"));
                }
            }
        }

        let result: ToolResult;
        try {
            result = await tool.execute(params, ctx);
        } catch (error) {
            result = err(`Internal error: ${errorMessage(error)}`, {
                metadata: { toolName: name },
            });
        }
        await hooks?.triggerAfterTool(name, params, result);
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

    for (const definition of getDefaultSubagentDefinitions()) {
        toolRegistry.register(createSubagentTool(definition));
    }

    return { toolRegistry };
};
