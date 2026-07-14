import { OpenRouter } from "@openrouter/sdk";
import { OpenRouterError, TooManyRequestsResponseError } from "@openrouter/sdk/models/errors";
import type { ChatMessages, ChatRequest } from "@openrouter/sdk/models";
import type { StreamEvent, TokenUsage } from "./types";
import { sleep } from "bun";

export class LLMClient {
    private _client: OpenRouter | null = null;
    private readonly _maxRetries = 3;

    private _getClient(): OpenRouter {
        this._client ??= new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
        return this._client;
    }

    close(): void {
        this._client = null;
    }

    async *chat_completion(
        messages: Array<ChatMessages>,
        stream: boolean = true,
    ): AsyncGenerator<StreamEvent, void, unknown> {
        const client = this._getClient();
        const args: ChatRequest = {
            model: process.env.LLM_MODEL,
            messages,
            stream,
        };
        for (let attempt = 1; attempt <= this._maxRetries; attempt++) {
            try {
                if (stream) {
                    yield* this._stream_response(client, args);
                } else {
                    yield await this._non_stream_response(client, args);
                }
                return;
            } catch (error) {
                if (this._shouldRetry(error) && attempt < this._maxRetries) {
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

        for await (const chunk of response) {
            const choice = chunk.choices[0];

            const content = choice?.delta?.content;
            if (content) {
                yield { type: "text_delta", text_delta: content };
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
