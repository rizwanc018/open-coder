import z from "zod";
import type { Config } from "../config/config";
import { errorMessage } from "../utils/error";
import { defineTool, err, ok, TOOL_KIND, type AnyTool } from "./types";
import type { TokenUsage } from "../client/types";

export interface SubagentDefinition {
    name: string;
    description: string;
    goalPrompt: string;
    allowedTools?: string[];
    maxTurns?: number;
    timeoutSeconds?: number;
    isMutating?: boolean;
}

export const createSubagentTool = (definition: SubagentDefinition): AnyTool => {
    const maxTurns = definition.maxTurns ?? 50;
    const timeoutSeconds = definition.timeoutSeconds ?? 600;

    return defineTool({
        name: `subagent_${definition.name}`,
        description: definition.description,
        kind: TOOL_KIND.Subagent,
        schema: z.object({
            goal: z
                .string()
                .trim()
                .min(1)
                .describe("The specific task or goal for the subagent to accomplish"),
        }),
        isMutating: () => definition.isMutating ?? true,

        async execute({ goal }, ctx) {
            const { Agent } = await import("../agent/agent");

            if (!goal) return err("No goal is specified for the sub-agent");

            const subConfig: Config = {
                ...ctx.config,
                maxTurns,
                allowedTools: definition.allowedTools ?? ctx.config.allowedTools,
            };

            const prompt = [
                "You are a specialized sub-agent with a specific task to complete.",
                "",
                definition.goalPrompt,
                "",
                "YOUR TASK:",
                goal,
                "",
                "IMPORTANT:",
                "- Focus only on completing the specified task",
                "- Do not engage in unrelated actions",
                "- Once you have completed the task or have the answer, provide your final response",
                "- Be concise and direct in your output",
            ].join("\n");

            const toolCalls: string[] = [];
            let finalResponse: string | null = null;
            let terminationReason = "goal";
            let failure: string | null = null;
            let usage: TokenUsage | null = null;

            const timeout = AbortSignal.timeout(timeoutSeconds * 1000);
            const signal = ctx.signal ? AbortSignal.any([ctx.signal, timeout]) : timeout;

            const agent = new Agent(subConfig);

            try {
                for await (const event of agent.run(prompt, signal)) {
                    switch (event.type) {
                        case "tool_call_start":
                            toolCalls.push(event.name);
                            break;
                        case "text_complete":
                            finalResponse = event.content;
                            break;
                        case "agent_end":
                            finalResponse ??= event.final_response;
                            usage = event.usage;
                            break;
                        case "agent_error":
                            terminationReason = "error";
                            failure = event.error;
                            break;
                    }
                }
            } catch (error) {
                if (timeout.aborted) {
                    terminationReason = "timeout";
                    failure = `Sub-agent timed out after ${timeoutSeconds}s`;
                } else if (ctx.signal?.aborted) {
                    terminationReason = "cancelled";
                    failure = "Sub-agent was cancelled";
                } else {
                    terminationReason = "error";
                    failure = errorMessage(error);
                }
            } finally {
                agent.close();
            }

            const summary = [
                `Sub-agent '${definition.name}' finished.`,
                `Termination: ${terminationReason}`,
                `Tools called: ${toolCalls.length > 0 ? toolCalls.join(", ") : "none"}`,
                "",
                "Result:",
                failure ?? finalResponse ?? "No response",
            ].join("\n");

            return failure ? err(summary) : ok(summary);
        },
    });
};

export const CODEBASE_INVESTIGATOR: SubagentDefinition = {
    name: "codebase_investigator",
    description:
        "Investigates the codebase to answer questions about code structure, patterns, and implementations. Read-only.",
    goalPrompt: [
        "You are a codebase investigation specialist.",
        "Your job is to explore and understand code to answer questions.",
        "Use read_file, grep, glob, and list_dir to investigate.",
        "Do NOT modify any files.",
    ].join("\n"),
    isMutating: false,
    allowedTools: ["read_file", "grep", "glob", "list_dir"],
};

export const CODE_REVIEWER: SubagentDefinition = {
    name: "code_reviewer",
    description: "Reviews code changes and provides feedback on quality, bugs, and improvements. Read-only.",
    goalPrompt: [
        "You are a code review specialist.",
        "Your job is to review code and provide constructive feedback.",
        "Look for bugs, code smells, security issues, and improvement opportunities.",
        "Use read_file, list_dir, and grep to examine the code.",
        "Do NOT modify any files.",
    ].join("\n"),
    allowedTools: ["read_file", "grep", "list_dir"],
    maxTurns: 10,
    timeoutSeconds: 300,
};

export function getDefaultSubagentDefinitions(): SubagentDefinition[] {
    return [CODEBASE_INVESTIGATOR, CODE_REVIEWER];
}
