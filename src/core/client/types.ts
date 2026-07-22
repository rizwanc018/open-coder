
export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens: number;
}

export type StreamEvent =
    | { type: "text_delta"; text_delta: string }
    | { type: "tool_call_start"; callId: string; name: string; arguments: Record<string, unknown> }
    | { type: "tool_call_delta"; callId: string; argumentsDelta: string }
    | { type: "tool_call_complete"; callId: string; name: string; arguments: Record<string, unknown> }
    | {
          type: "message_complete";
          text_delta: string | null;
          finish_reason: string | null;
          usage: TokenUsage | null;
      }
    | { type: "error"; error: string };

export type StreamEventType = StreamEvent["type"];
