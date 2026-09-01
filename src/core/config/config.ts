import { statSync } from "node:fs";
import z from "zod";

export const APPROVAL_POLICIES = ["on-request", "auto", "auto-edit", "never", "yolo"] as const;
export type ApprovalPolicy = (typeof APPROVAL_POLICIES)[number];

export const HOOK_TRIGGERS = [
    "before_agent",
    "after_agent",
    "before_tool",
    "after_tool",
    "on_error",
] as const;
export type HookTrigger = (typeof HOOK_TRIGGERS)[number];

const MISSING_MODEL = "Missing model name. Set `model.name` in your config file.";

const modelConfigSchema = z.object(
    {
        name: z.string(MISSING_MODEL).min(1, MISSING_MODEL),
        temperature: z.number().min(0).max(2).default(1),
        contextWindow: z.number().int().positive().default(500_000), //500_000
    },
    MISSING_MODEL,
);

const shellEnvironmentPolicySchema = z.object({
    disableExcludes: z.boolean().default(false),
    excludePatterns: z.array(z.string()).default(["*KEY*", "*TOKEN*", "*SECRET*"]),
    setVars: z.record(z.string(), z.string()).default({}),
});

const hookConfigSchema = z
    .object({
        name: z.string(),
        trigger: z.enum(HOOK_TRIGGERS),
        command: z.string().optional(),
        script: z.string().optional(),
        timeoutSec: z.number().positive().default(30),
        enabled: z.boolean().default(true),
    })
    .refine((h) => Boolean(h.command) || Boolean(h.script), {
        error: "Hook must have either 'command' or 'script'",
    });

export const configSchema = z.object({
    model: modelConfigSchema,
    cwd: z.string().default(() => process.cwd()),
    maxTurns: z.number().int().positive().default(150),
    developerInstructions: z.string().nullable().default(null),
    userInstructions: z.string().nullable().default(null),
    shellEnvironment: shellEnvironmentPolicySchema.prefault({}),
    allowedTools: z.array(z.string()).nullable().default(null),
    approval: z.enum(APPROVAL_POLICIES).default("on-request"),
    hooksEnabled: z.boolean().default(false),
    hooks: z.array(hookConfigSchema).default([]),
    debug: z.boolean().default(false),
});

export type Config = z.infer<typeof configSchema>;
export type ShellEnvironmentPolicy = z.infer<typeof shellEnvironmentPolicySchema>;
export type HookConfig = z.infer<typeof hookConfigSchema>;

export function apiKey(): string | undefined {
    return process.env.OPENROUTER_API_KEY;
}

export function validateConfig(config: Config): string[] {
    const errors: string[] = [];

    if (!apiKey()?.trim()) {
        errors.push(
            "No API key found. Set the Openrouter api key in .env file {OPENROUTER_API_KEY=<api key> }.",
        );
    }

    let isDirectory = false;
    try {
        isDirectory = statSync(config.cwd).isDirectory();
    } catch {
        isDirectory = false;
    }
    if (!isDirectory) {
        errors.push(`Working directory does not exist: ${config.cwd}`);
    }

    return errors;
}
