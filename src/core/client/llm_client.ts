import { OpenRouter } from "@openrouter/sdk";
import { OpenRouterError, TooManyRequestsResponseError } from "@openrouter/sdk/models/errors";
import type { ChatMessages, ChatRequest } from "@openrouter/sdk/models";
import type { StreamEvent, TokenUsage } from "./types";
import { sleep } from "bun";
import type { ToolSchema } from "../tools/types";
import { parseToolCallArguments } from "../utils/tool";
import { apiKey, type Config } from "../config/config";

interface CompletionOptions {
    tools?: ToolSchema[];
    stream?: boolean;
    signal?: AbortSignal;
}
export class LLMClient {
    private _client: OpenRouter | null = null;
    private readonly _MAX_RETRIES = 3;
    private readonly _config: Config;

    constructor(config: Config) {
        this._config = config;
    }

    private _getClient(): OpenRouter {
        this._client ??= new OpenRouter({ apiKey: apiKey(this._config) });
        return this._client;
    }

    close(): void {
        this._client = null;
    }

    async *chat_completion(
        messages: Array<ChatMessages>,
        options: CompletionOptions = {},
    ): AsyncGenerator<StreamEvent, void, unknown> {
        const { tools, stream = true, signal } = options;

        const client = this._getClient();
        const args: ChatRequest = {
            model: this._config.model.name,
            temperature: this._config.model.temperature,
            messages,
            stream,
        };

        if (tools && tools.length > 0) {
            args.tools = tools.map((tool) => ({
                type: "function",
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                },
            }));
            args.toolChoice = "auto";
        }
        for (let attempt = 1; attempt <= this._MAX_RETRIES; attempt++) {
            try {
                if (stream) {
                    yield* this._stream_response(client, args);
                } else {
                    yield await this._non_stream_response(client, args);
                }
                return;
            } catch (error) {
                if (this._shouldRetry(error) && attempt < this._MAX_RETRIES) {
                    const waitMs = 1000 * 2 ** (attempt - 1);
                    await sleep(waitMs);
                    continue;
                }
                yield this._to_error_event(error);
                return;
            }
        }
    }

    private async *_stream_response(
        client: OpenRouter,
        args: ChatRequest,
    ): AsyncGenerator<StreamEvent, void, unknown> {
        const response = await client.chat.send({ chatRequest: { ...args, stream: true } });

        let finish_reason: string | null = null;
        let usage: TokenUsage | null = null;
        const pending = new Map<number, { id: string; name: string; args: string }>();

        for await (const chunk of response) {
            const choice = chunk.choices[0];
            if (!choice) continue;

            const content = choice.delta?.content;
            if (content) {
                yield { type: "text_delta", text_delta: content };
            }

            const toolCallsdelta = choice.delta.toolCalls;

            for (const tcDelta of toolCallsdelta ?? []) {
                const index = tcDelta.index;
                let entry = pending.get(index);

                if (!entry) {
                    entry = { id: tcDelta.id ?? "", name: "", args: "" };
                    pending.set(index, entry);
                }
                if (tcDelta.id) entry.id = tcDelta.id;
                if (tcDelta.function?.name) {
                    entry.name = tcDelta.function.name;
                    yield {
                        type: "tool_call_start",
                        callId: entry.id,
                        name: entry.name,
                        arguments: {},
                    };
                }
                if (tcDelta.function?.arguments) {
                    entry.args += tcDelta.function.arguments;
                    yield {
                        type: "tool_call_delta",
                        callId: entry.id,
                        argumentsDelta: tcDelta.function.arguments,
                    };
                }
            }

            if (choice?.finishReason) finish_reason = choice.finishReason;

            if (chunk.usage) {
                usage = {
                    promptTokens: chunk.usage.promptTokens,
                    completionTokens: chunk.usage.completionTokens,
                    totalTokens: chunk.usage.totalTokens,
                    cachedTokens: chunk.usage.promptTokensDetails?.cachedTokens || 0,
                };
            }
        }

        for (const entry of pending.values()) {
            yield {
                type: "tool_call_complete",
                callId: entry.id,
                name: entry.name,
                arguments: parseToolCallArguments(entry.args),
            };
        }

        yield { type: "message_complete", text_delta: null, finish_reason, usage };
    }

    private async _non_stream_response(client: OpenRouter, args: ChatRequest): Promise<StreamEvent> {
        const response = await client.chat.send(
            { chatRequest: { ...args, stream: false } },
            { fetchOptions: { signal: AbortSignal.timeout(60_000) } },
        );

        const choice = response.choices[0];
        const message = choice?.message;

        let usage: TokenUsage | null = null;
        let text_delta = message?.content ? message.content : null;
        let finish_reason: string | null = choice?.finishReason ? choice?.finishReason : null;

        if (message?.content) text_delta = message.content;

        if (response.usage) {
            usage = {
                promptTokens: response.usage.promptTokens,
                completionTokens: response.usage.completionTokens,
                totalTokens: response.usage.totalTokens,
                cachedTokens: response.usage.promptTokensDetails?.cachedTokens || 0,
            };
        }

        return { type: "message_complete", text_delta, finish_reason, usage };
    }

    private _to_error_event(error: unknown): StreamEvent {
        let message: string;
        if (error instanceof TooManyRequestsResponseError) {
            message = `Rate limit exceeded: ${error.error.message}`;
        } else if (error instanceof OpenRouterError) {
            message = `API error (${error.statusCode}): ${error.message}`;
        } else if (error instanceof Error) {
            message = error.message;
        } else {
            message = String(error);
        }

        return { type: "error", error: message };
    }

    private _shouldRetry(error: unknown): boolean {
        if (error instanceof TooManyRequestsResponseError) {
            return true;
        }
        if (error instanceof OpenRouterError && error.statusCode && error.statusCode >= 500) {
            return true;
        }
        // if (error instanceof Error && error.name === "AbortError") {
        //     return false;
        // }
        return false;
    }
}
