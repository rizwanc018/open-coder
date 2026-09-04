import { statSync } from "node:fs";
import z from "zod";
import { userConfigFile } from "./pathLoader";

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
    apiKey: z.string().nullable().default(null),
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

export type ApiKeySource = "environment" | "config file";

/**
 * Resolution order: environment first (works for CI and one-off overrides), then
 * the user config file. Under Bun a project `.env` is loaded into the environment
 * automatically, so it keeps working for development from inside a checkout.
 */
export function apiKey(config: Config): string | undefined {
    return process.env.OPENROUTER_API_KEY?.trim() || config.apiKey?.trim() || undefined;
}

export function apiKeySource(config: Config): ApiKeySource | null {
    if (process.env.OPENROUTER_API_KEY?.trim()) return "environment";
    if (config.apiKey?.trim()) return "config file";
    return null;
}

export function validateConfig(config: Config): string[] {
    const errors: string[] = [];

    if (!apiKey(config)) {
        errors.push(
            "No OpenRouter API key found.\n Either set OPENROUTER_API_KEY in your environment, " +
                `or add {"apiKey": "sk-or-..."} to ${userConfigFile()}`,
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
