import type { LLMClient } from "../client/llm_client";
import type { TokenUsage } from "../client/types";
import type { CompactionPlan, ContextManager } from "./manager";
import { getCompactionPrompt } from "../prompts/system";
import { truncateChars } from "../utils/text";
import type { ChatMessages } from "@openrouter/sdk/models";

export interface CompactionResult {
    summary: string | null;
    usage: TokenUsage | null;
    plan: CompactionPlan | null;
}
// Then the prune tier as the fallback for when summarization fails.

const EMPTY_RESULT: CompactionResult = { summary: null, usage: null, plan: null };

export class ChatCompactor {
    private readonly _client: LLMClient;

    constructor(client: LLMClient) {
        this._client = client;
    }

    async compact(context: ContextManager): Promise<CompactionResult> {
        const plan = context.planCompaction();

        if (!plan || plan.prefix.length < 2) return EMPTY_RESULT;

        const request: ChatMessages[] = [
            { role: "system", content: getCompactionPrompt() },
            { role: "user", content: this.formatChatHistory(plan.prefix) },
        ];

        try {
            for await (const event of this._client.chat_completion(request, { stream: false })) {
                if (event.type === "message_complete" && event.text_delta) {
                    return { summary: event.text_delta, usage: event.usage, plan };
                }
                if (event.type === "error") return EMPTY_RESULT;
            }
        } catch {
            return EMPTY_RESULT;
        }
        return EMPTY_RESULT;
    }

    private formatChatHistory(messages: ChatMessages[]): string {
        const parts = ["Here is the earlier portion of the conversation to compact:\n"];

        for (const msg of messages) {
            const content = msg.content ?? "";

            switch (msg.role) {
                case "system":
                    continue;
                case "tool":
                    parts.push(
                        `[Tool Result (${msg.toolCallId ?? "unknown"})]:\n` +
                            truncateChars(content, 2000, "\n... [truncated]"),
                    );
                    break;
                case "assistant": {
                    if (content) {
                        parts.push(`Assistant:\n${truncateChars(content, 3000, "\n... [truncated]")}`);
                    }

                    if (msg.toolCalls?.length) {
                        const calls = msg.toolCalls.map((call) => {
                            const args = truncateChars(call.function.arguments, 500, "...");
                            return `  - ${call.function.name}(${args})`;
                        });
                        parts.push(`Assistant called tools:\n${calls.join("\n")}`);
                    }
                    break;
                }
                case "user":
                    parts.push(`User:\n${truncateChars(content, 1500, "\n... [truncated]")}`);
                    break;
            }
        }

        return parts.join("\n\n---\n\n");
    }
}
