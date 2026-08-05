import { getSystemPrompt } from "../prompts/system";
import { countTokens } from "../utils/text";
import type { MessageItem } from "./types";
import type { ToolCall } from "../agent/types";
import type { ChatMessages, ChatToolCall } from "@openrouter/sdk/models";
import type { Config } from "../config/config";

export class ContextManager {
    private readonly _config: Config;
    private readonly _systemPrompt: string;
    private _messages: MessageItem[] = [];

    constructor(config: Config) {
        this._config = config;
        this._systemPrompt = getSystemPrompt(config);
    }

    addUserMessage(content: string): void {
        this._messages.push({
            message: { role: "user", content },
            tokenCount: countTokens(content),
        });
    }

    addAssistantMessage(content: string | null, toolCalls: ToolCall[] = []): void {
        const text = content ?? "";
        const sdkToolCalls: ChatToolCall[] = toolCalls.map((call) => ({
            id: call.callId,
            type: "function",
            function: {
                name: call.name,
                arguments: JSON.stringify(call.arguments),
            },
        }));

        this._messages.push({
            message: {
                role: "assistant",
                content: text,
                ...(sdkToolCalls.length > 0 ? { toolCalls: sdkToolCalls } : {}),
            },
            tokenCount: countTokens(text + sdkToolCalls.map((tc) => tc.function.arguments).join("")),
        });
    }

    addToolResult(callId: string, content: string): void {
        this._messages.push({
            message: { role: "tool", content, toolCallId: callId },
            tokenCount: countTokens(content),
        });
    }

    getTokenCount(): number {
        return this._messages.reduce((total, item) => total + item.tokenCount, countTokens(this._systemPrompt));
    }

    isOverContextWindow(): boolean {
        return this.getTokenCount() >= this._config.model.contextWindow;
    }

    getMessages(): ChatMessages[] {
        const messages: ChatMessages[] = [];
        if (this._systemPrompt) {
            messages.push({ role: "system", content: this._systemPrompt });
        }
        for (const { message } of this._messages) {
            messages.push(message);
        }
        return messages;
    }
}
