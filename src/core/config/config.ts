import { statSync } from "node:fs";
import z from "zod";

const modelConfigSchema = z.object({
    name: z.string().default("nvidia/nemotron-3-super-120b-a12b:free"),
    temperature: z.number().min(0).max(2).default(1),
    contextWindow: z.number().int().positive().default(500_000),
});

export const configSchema = z.object({
    model: modelConfigSchema.prefault({}),
    cwd: z.string().default(() => process.cwd()),
    maxTurns: z.number().int().positive().default(150),
    developerInstructions: z.string().nullable().default(null),
    userInstructions: z.string().nullable().default(null),
    debug: z.boolean().default(false),
});

export type Config = z.infer<typeof configSchema>;

export function apiKey(): string | undefined {
    return process.env.OPENROUTER_API_KEY;
}

export function validateConfig(config: Config): string[] {
    const errors: string[] = [];

    if (!apiKey()?.trim()) {
        errors.push("No API key found. Set the Openrouter api key in .env file {OPENROUTER_API_KEY=<api key> }.");
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
