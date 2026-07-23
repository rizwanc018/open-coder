import { getSystemPrompt } from "../prompts/system";
import { countTokens } from "../utils/text";
import type { MessageItem } from "./types";
import type { ToolCall } from "../agent/types";
import type { ChatMessages, ChatToolCall } from "@openrouter/sdk/models";

export class ContextManager {
    private readonly _systemPrompt: string = getSystemPrompt();
    private _messages: MessageItem[] = [];

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
