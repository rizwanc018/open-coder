import type { ChatMessages } from "@openrouter/sdk/models";

export type MessageRole = "system" | "user" | "assistant" | "tool";



export interface MessageItem {
    message: ChatMessages;
    tokenCount: number;
}