import type { LLMClient } from "../client/llm_client";
import type { TokenUsage } from "../client/types";
import type { ContextManager } from "./manager";
import { getCompactionPrompt } from "../prompts/system";
import { truncateChars } from "../utils/text";
import type { ChatMessages } from "@openrouter/sdk/models";

export interface CompactionResult {
    summary: string | null;
    usage: TokenUsage | null;
}

export class ChatCompactor {
    private readonly _client: LLMClient;

    constructor(client: LLMClient) {
        this._client = client;
    }

    async compact(context: ContextManager): Promise<CompactionResult> {
        const messages = context.getMessages();

        if (messages.length < 3) return { summary: null, usage: null };

        const request: ChatMessages[] = [
            { role: "system", content: getCompactionPrompt() },
            { role: "user", content: this.formatChatHistory(messages) },
        ];

        try {
            for await (const event of this._client.chat_completion(request, { stream: false })) {
                if (event.type === "message_complete" && event.text_delta) {
                    return { summary: event.text_delta, usage: event.usage };
                }
                if (event.type === "error") return { summary: null, usage: null };
            }
        } catch {
            return { summary: null, usage: null };
        }
        return { summary: null, usage: null };
    }

    private formatChatHistory(messages: ChatMessages[]): string {
        const parts = ["Here is the conversation that needs to be continued:\n"];

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
