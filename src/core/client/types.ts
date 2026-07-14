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

export type StreamEvent =
    | { type: "text_delta"; text_delta: string }
    | { type: "tool_call_start"; toolCall: ToolCall }
    | { type: "tool_call_delta"; callId: string; argumentsDelta: string }
    | { type: "tool_call_complete"; toolCall: ToolCall }
    | { type: "message_complete"; text_delta: string | null; finish_reason: string | null; usage: TokenUsage | null }
    | { type: "error"; error: string };

export type StreamEventType = StreamEvent["type"];
