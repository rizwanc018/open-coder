import type { ChatMessages } from "@openrouter/sdk/models";

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface MessageItem {
    message: ChatMessages;
    tokenCount: number;
}

export interface ChatMessage {
    role: MessageRole;
    content?: string;
    tool_call_id?: string;
    tool_calls?: {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
    }[];
}
