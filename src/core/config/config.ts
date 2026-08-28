import { statSync } from "node:fs";
import z from "zod";

const MISSING_MODEL = "Missing model name. Set `model.name` in your config file.";

const modelConfigSchema = z.object(
    {
        name: z.string(MISSING_MODEL).min(1, MISSING_MODEL),
        temperature: z.number().min(0).max(2).default(1),
        contextWindow: z.number().int().positive().default(500_000),//500_000
    },
    MISSING_MODEL,
);

const shellEnvironmentPolicySchema = z.object({
    disableExcludes: z.boolean().default(false),
    excludePatterns: z.array(z.string()).default(["*KEY*", "*TOKEN*", "*SECRET*"]),
    setVars: z.record(z.string(), z.string()).default({}),
});

export const configSchema = z.object({
    model: modelConfigSchema,
    cwd: z.string().default(() => process.cwd()),
    maxTurns: z.number().int().positive().default(150),
    developerInstructions: z.string().nullable().default(null),
    userInstructions: z.string().nullable().default(null),
    shellEnvironment: shellEnvironmentPolicySchema.prefault({}),
    allowedTools: z.array(z.string()).nullable().default(null),
    debug: z.boolean().default(false),
});

export type Config = z.infer<typeof configSchema>;
export type ShellEnvironmentPolicy = z.infer<typeof shellEnvironmentPolicySchema>;

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
