import { existsSync } from "node:fs";
import { defineTool, err, ok, TOOL_KIND, type ShellExecution } from "../types";
import { resolvePath } from "../../utils/path";
import z from "zod";
import type { ShellEnvironmentPolicy } from "../../config/config";
import { truncateChars } from "../../utils/text";
import { errorMessage } from "../../utils/error";

type CommandRule = {
    pattern: RegExp;
    reason: string;
};

const MAX_OUTPUT_BYTES = 100 * 1024;
const BLOCKED_COMMANDS: CommandRule[] = [
    {
        pattern: /\brm\s+(?:-[a-z]*\s+)*-[a-z]*r[a-z]*f[a-z]*\s+\/(?:\s|$)/i,
        reason: "recursive force deletion of filesystem root",
    },
    {
        pattern: /\brm\s+(?:-[a-z]*\s+)*-[a-z]*r[a-z]*f[a-z]*\s+~(?:\s|$)/i,
        reason: "recursive force deletion of home directory",
    },
    {
        pattern: /\bmkfs(?:\.[\w-]+)?\b/i,
        reason: "filesystem formatting",
    },
    {
        pattern: /\b(?:fdisk|parted)\b/i,
        reason: "disk partition modification",
    },
    {
        pattern: /\bdd\b.*\bof=\/dev\/(?:sd[a-z]+|nvme\d+n\d+|vd[a-z]+)\b/i,
        reason: "direct disk overwrite",
    },
    {
        pattern: /\b(?:shutdown|reboot|poweroff|halt)\b/i,
        reason: "system shutdown",
    },
];

const matchesPattern = (name: string, pattern: string): boolean => {
    const regex = new RegExp(
        `^${pattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, ".*")
            .replace(/\?/g, ".")}$`,
        "i",
    );
    return regex.test(name);
};

const buildEnvironment = (policy: ShellEnvironmentPolicy): Record<string, string> => {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value === undefined) continue;
        const excluded =
            !policy.disableExcludes && policy.excludePatterns.some((pattern) => matchesPattern(key, pattern));
        if (!excluded) env[key] = value;
    }
    return { ...env, ...policy.setVars };
};

const getBlockedReason = (command: string): string | undefined => {
    return BLOCKED_COMMANDS.find(({ pattern }) => pattern.test(command))?.reason;
};

function formatShellOutput(execution: ShellExecution): string {
    const sections: string[] = [];

    if (execution.stdout) {
        sections.push(execution.stdout);
    }

    if (execution.stderr) {
        sections.push(`--- stderr ---\n${execution.stderr}`);
    }

    if (execution.exitCode !== 0) {
        sections.push(`Exit code: ${execution.exitCode}`);
    }

    return sections.join("\n");
}

const schema = z.object({
    command: z.string().describe("The shell command to execute"),
    timeout: z.number().int().min(1).max(300).default(120).describe("Timeout in seconds (default: 120)"),
    cwd: z.string().optional().describe("Working directory for the command"),
});

export const shellTool = defineTool({
    name: "shell",
    description: "Execute a shell command. Use this for running system commands, scripts, and CLI tools.",
    kind: TOOL_KIND.Shell,
    schema,
    async execute({ command, timeout, cwd: rawCwd }, ctx) {
        const blockedReason = getBlockedReason(command);

        if (blockedReason) {
            return err(`Command blocked for safety: ${blockedReason}`, {
                metadata: {
                    blocked: true,
                    reason: blockedReason,
                },
            });
        }

        const cwd = rawCwd ? resolvePath(ctx.cwd, rawCwd) : ctx.cwd;

        if (!existsSync(cwd)) return err(`Working directory does not exist: ${cwd}`);

        const shell =
            process.platform === "win32" ? ["cmd.exe", "/c", command] : ["/bin/bash", "-c", command];

        const env = buildEnvironment(ctx.config.shellEnvironment);

        const timeoutSignal = AbortSignal.timeout(timeout * 1000);
        const signal = ctx.signal ? AbortSignal.any([ctx.signal, timeoutSignal]) : timeoutSignal;

        const startedAt = performance.now();

        try {
            const proc = Bun.spawn(shell, {
                cwd,
                env,
                stdout: "pipe",
                stderr: "pipe",
                signal,
            });

            const [stdout, stderr, exitCode] = await Promise.all([
                new Response(proc.stdout).text(),
                new Response(proc.stderr).text(),
                proc.exited,
            ]);

            const durationMs = Math.round(performance.now() - startedAt);

            const execution = {
                stdout: truncateChars(stdout.trimEnd(), MAX_OUTPUT_BYTES),
                stderr: truncateChars(stderr.trimEnd(), MAX_OUTPUT_BYTES),
                exitCode,
                termination: "exited" as const,
                durationMs,
            };

            const output = formatShellOutput(execution);

            if (exitCode === 0) {
                return ok(output, {
                    shell: execution,
                    metadata: {
                        command,
                        cwd,
                    },
                });
            }

            return err(output, {
                shell: execution,
                metadata: {
                    command,
                    cwd,
                },
            });
        } catch (error) {
            if (timeoutSignal.aborted) {
                return err(`Command timed out after ${timeout}s`);
            }
            if (ctx.signal?.aborted) {
                return err("Command cancelled");
            }
            return err(`Command failed: ${errorMessage(error)}`);
        }
    },
});
