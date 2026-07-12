export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens: number;
}

export interface ToolCall {
    callId: string;
    name: string;
    arguments: Record<string, unknown>;
}

export type StreamEventType =
    | "text_delta"
    | "tool_call_start"
    | "tool_call_delta"
    | "tool_call_complete"
    | "message_complete"
    | "error";

export interface StreamEvent {
    type: StreamEventType;
    text_delta: string | null;
    error?: string | null;
    finish_reason: string | null;
    usage: TokenUsage | null;
}
