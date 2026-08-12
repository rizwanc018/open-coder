import { LLMClient } from "../client/llm_client";
import type { TokenUsage } from "../client/types";
import type { AgentEvent, ToolCall } from "./types";
import { errorMessage } from "../utils/error";
import type { Config } from "../config/config";
import { Session } from "./session";
import { debug } from "../../shared/debug";

export class Agent {
    session: Session;
    _closed = false;

    constructor(config: Config) {
        this.session = new Session(config);
    }

    private _getClient(): LLMClient {
        if (!this.session?._client) throw new Error("Agent is closed");
        return this.session._client;
    }

    private _assertOpen(): void {
        if (this._closed) throw new Error("Agent is closed");
    }

    private async *_agentic_loop(signal?: AbortSignal): AsyncGenerator<AgentEvent> {
        this._assertOpen();

        const toolSchemas = this.session._toolRegistry.getSchemas();
        for (let turn = 0; turn < this.session._config.maxTurns; turn++) {
            let responseText = "";
            let usage: TokenUsage | null = null;
            const toolCalls: ToolCall[] = [];
            let errored: boolean = false;

            const messages = this.session._contextManager.getMessages();
            this.session.incrementTurn();

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
                        toolCalls.push({
                            name: event.name,
                            callId: event.callId,
                            arguments: event.arguments,
                        });
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

            this.session._contextManager.addAssistantMessage(responseText, toolCalls);

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

                const result = await this.session._toolRegistry.invoke(tc.name, tc.arguments, {
                    cwd: this.session._config.cwd,
                    signal,
                });

                const resultContent = result.success ? result.output : (result.error ?? result.output ?? "");

                this.session._contextManager.addToolResult(tc.callId, resultContent);

                yield {
                    type: "tool_call_complete",
                    callId: tc.callId,
                    name: tc.name,
                    arguments: tc.arguments,
                    result,
                };
            }
        }

        yield {
            type: "agent_error",
            error: `Reached the maximum of ${this.session._config.maxTurns} turns without finishing.`,
        };
    }

    async *run(message: string, signal?: AbortSignal): AsyncGenerator<AgentEvent> {
        yield { type: "agent_start", message };
        this.session._contextManager.addUserMessage(message);

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
            yield { type: "agent_error", error: errorMessage(error) };
        }

        yield { type: "agent_end", final_response, usage };
    }

    close(): void {
        if (this._closed || !this.session._client) return;
        this.session._client.close();
        this._closed = true;
    }
}
