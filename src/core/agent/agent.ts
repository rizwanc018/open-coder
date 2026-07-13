import type { ChatMessages } from "@openrouter/sdk/models";
import { LLMClient } from "../client/llm_client";
import type { TokenUsage } from "../client/types";
import type { AgentEvent } from "./types";

export class Agent {
    private _client: LLMClient | null = new LLMClient();

    private _getClient(): LLMClient {
        if (!this._client) throw new Error("Agent is closed");
        return this._client;
    }

    private async *_agentic_loop(message: string, signal?: AbortSignal): AsyncGenerator<AgentEvent> {
        let responseText = "";
        let usage: TokenUsage | null = null;

        const messages = [{ role: "user" as const, content: message }];

        for await (const event of this._getClient().chat_completion(messages, true)) {
            if (signal?.aborted) return;

            switch (event.type) {
                case "text_delta":
                    if (event.text_delta) {
                        responseText += event.text_delta;
                        yield { type: "text_delta", content: event.text_delta };
                    }
                    break;

                case "message_complete":
                    usage = event.usage;
                    break;

                case "error":
                    yield { type: "agent_error", error: event.error ?? "Unknown error occured" };
                    return;

                default:
                    break;
            }
        }

        yield { type: "text_complete", content: responseText, usage };
    }

    async *run(message: string, signal?: AbortSignal): AsyncGenerator<AgentEvent> {
        yield { type: "agent_start", message };

        let final_response: string | null = null;
        let usage: TokenUsage | null = null;

        for await (const event of this._agentic_loop(message)) {
            yield event;

            if (event.type === "text_complete") {
                final_response = event.content;
                usage = event.usage;
            }
        }

        yield { type: "agent_end", final_response, usage };
    }

    close(): void {
        if (this._client) this._client.close();
        this._client = null;
    }
}
