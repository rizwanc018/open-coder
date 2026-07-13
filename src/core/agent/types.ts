import type { TokenUsage } from "../client/types";

export type AgentEvent =
  | { type: "agent_start"; message: string }
  | { type: "agent_end"; final_response: string | null; usage: TokenUsage | null }
  | { type: "agent_error"; error: string, details?: Record<string, any> }
  
  | { type: "text_delta"; content: string }
  | { type: "text_complete"; content: string, usage: TokenUsage | null; }

  //   | { type: "tool_call_start"; callId: string; name: string; args: Record<string, unknown> }
  //   | { type: "tool_call_complete"; callId: string; name: string; result: ToolResult }
  | { type: "compaction_start" }
  | { type: "compaction_end"; ok: boolean }
  
  | { type: "thinking"; turn: number }

export type AgentEventType = AgentEvent["type"];
