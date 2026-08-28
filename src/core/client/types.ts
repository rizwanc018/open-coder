export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens: number;
}

export const EMPTY_USAGE: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cachedTokens: 0,
};

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
    return {
        promptTokens: a.promptTokens + b.promptTokens,
        completionTokens: a.completionTokens + b.completionTokens,
        totalTokens: a.totalTokens + b.totalTokens,
        cachedTokens: a.cachedTokens + b.cachedTokens,
    };
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
