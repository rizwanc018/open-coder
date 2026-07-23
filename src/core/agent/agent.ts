import { LLMClient } from "../client/llm_client";
import type { TokenUsage } from "../client/types";
import type { AgentEvent, ToolCall } from "./types";
import { ContextManager } from "../context/manager";
import { createToolDefaultRegistry, ToolRegistry } from "../tools/registry";
import { errorMessage } from "../utils/error";

export class Agent {
    private _client: LLMClient | null;
    private _toolRegistry: ToolRegistry;
    private _contextManager: ContextManager = new ContextManager();
    private _cwd: string;

    constructor() {
        this._client = new LLMClient();
        this._cwd = process.cwd();

        const { toolRegistry } = createToolDefaultRegistry();
        this._toolRegistry = toolRegistry;
    }

    private _getClient(): LLMClient {
        if (!this._client) throw new Error("Agent is closed");
        return this._client;
    }

    private async *_agentic_loop(signal?: AbortSignal): AsyncGenerator<AgentEvent> {
        const toolSchemas = this._toolRegistry.getSchemas();
        const maxIterations = 25;

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            let responseText = "";
            let usage: TokenUsage | null = null;
            const toolCalls: ToolCall[] = [];
            let errored: boolean = false;

            const messages = this._contextManager.getMessages();

            for await (const event of this._getClient().chat_completion(messages, {
                tools: toolSchemas,
                stream: true,
            })) {
                if (signal?.aborted) return;

                switch (event.type) {
                    case "text_delta":
                        if (event.text_delta) {
                            responseText += event.text_delta;
                            yield { type: "text_delta", content: event.text_delta };
                        }
                        break;

                    case "tool_call_complete":
                        toolCalls.push({ name: event.name, callId: event.callId, arguments: event.arguments });
                        break;

                    case "message_complete":
                        usage = event.usage;
                        break;

                    case "error":
                        errored = true;
                        yield { type: "agent_error", error: event.error ?? "Unknown error occured" };
                        return;

                    default:
                        break;
                }
            }

            if (errored) return;

            this._contextManager.addAssistantMessage(responseText, toolCalls);

            if (responseText) {
                yield { type: "text_complete", content: responseText, usage };
            }

            if (toolCalls.length === 0) {
                return;
            }

            for (const tc of toolCalls) {
                if (signal?.aborted) return;
                yield {
                    type: "tool_call_start",
                    callId: tc.callId,
                    name: tc.name,
                    arguments: tc.arguments,
                };

                const result = await this._toolRegistry.invoke(tc.name, tc.arguments, {
                    cwd: this._cwd,
                    signal,
                });

                const resultContent = result.success
                    ? result.output
                    : (result.error ?? result.output ?? "");

                this._contextManager.addToolResult(tc.callId, resultContent);

                yield {
                    type: "tool_call_complete",
                    callId: tc.callId,
                    name: tc.name,
                    arguments: tc.arguments,
                    result,
                };
            }
        }
    }

    async *run(message: string, signal?: AbortSignal): AsyncGenerator<AgentEvent> {
        yield { type: "agent_start", message };
        this._contextManager.addUserMessage(message);

        let final_response: string | null = null;
        let usage: TokenUsage | null = null;

        try {
            for await (const event of this._agentic_loop(signal)) {
                yield event;

                if (event.type === "text_complete") {
                    final_response = event.content;
                    usage = event.usage;
                }
            }
        } catch (error) {
            if (signal?.aborted) {
                yield { type: "agent_error", error: "Interrupted" };
            } else {
                yield { type: "agent_error", error: errorMessage(error) };
            }
        }

        yield { type: "agent_end", final_response, usage };
    }

    close(): void {
        if (this._client) this._client.close();
        this._client = null;
    }
}
