import z from "zod";

export const TOOL_KINDS = ["read", "write", "shell", "network", "memory", "mcp"] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];


export interface ToolContext {
    cwd: string;
    signal?: AbortSignal;
}

export interface ToolResult {
    success: boolean;
    output: string;
    error?: string;
    metadata?: Record<string, unknown>;
    truncated?: boolean;
}

export interface ToolSchema {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}

export interface ToolConfirmation {
    toolName: string;
    description: string;
    params: Record<string, unknown>;
}

type ResultExtras = Omit<ToolResult, "success" | "output" | "error">;

export interface Tool<S extends z.ZodType = z.ZodType> {
    name: string;
    description: string;
    kind: ToolKind;
    schema: S;

    jsonSchema?: Record<string, unknown>;

    isMutating?(params: Record<string, unknown>): boolean;

    confirm?(
        params: z.infer<S>,
        ctx: ToolContext,
    ): Promise<ToolConfirmation | null> | ToolConfirmation | null;

    execute(params: z.infer<S>, ctx: ToolContext): Promise<ToolResult>;
}

export type AnyTool = Tool<z.ZodType>;

export function defineTool<S extends z.ZodType>(tool: Tool<S>): Tool<S> {
    return tool;
}

export const isMutating = (tool: AnyTool, params: Record<string, unknown>): boolean => {
    if (tool.isMutating) return tool.isMutating(params);
    return tool.kind !== "read";
};

export const getConfirmation = async (
    tool: AnyTool,
    params: Record<string, unknown>,
    ctx: ToolContext,
): Promise<ToolConfirmation | null> => {
    if (tool.confirm) return await tool.confirm(params, ctx);
    if (!isMutating(tool, params)) return null;

    return {
        toolName: tool.name,
        description: `Execute ${tool.name}`,
        params,
    };
};

export const ok = (output: string, extras: ResultExtras = {}): ToolResult => {
    return { success: true, output, ...extras };
};

export const err = (error: string, extras: ResultExtras & { output?: string } = {}): ToolResult => {
    const { output = "", ...rest } = extras;
    return { success: false, output, error, ...rest };
};

export const toToolSchema = (tool: Tool): ToolSchema => {
    const parameters =
        tool.jsonSchema ??
        (z.toJSONSchema(tool.schema, { target: "draft-7", io: "input" }) as Record<string, unknown>);

    delete parameters.$schema;

    return {
        name: tool.name,
        description: tool.description,
        parameters: {
            type: "object",
            properties: parameters.properties ?? {},
            required: parameters.required ?? [],
        },
    };
};
