import { getSystemPrompt } from "../prompts/system";
import { countTokens } from "../utils/text";
import type { MessageItem } from "./types";
import type { ChatMessages } from "@openrouter/sdk/models";

export class ContextManager {
    private readonly _systemPrompt: string = getSystemPrompt();
    private _messages: MessageItem[] = [];

    addUserMessage(content: string): void {
        this._messages.push({
            message: { role: "user", content },
            tokenCount: countTokens(content),
        });
    }

    addAssistantMessage(content: string | null): void {
        this._messages.push({
            message: { role: "assistant", content: content ?? "" },
            tokenCount: countTokens(content ?? ""),
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
