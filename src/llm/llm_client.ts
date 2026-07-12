import { OpenRouter } from "@openrouter/sdk";
import { OpenRouterError, TooManyRequestsResponseError } from "@openrouter/sdk/models/errors";
import type { ChatMessages, ChatRequest } from "@openrouter/sdk/models";
import type { StreamEvent, TokenUsage } from "./types";

export class LLMClient {
    private client: OpenRouter | null = null;

    private get_client(): OpenRouter {
        this.client ??= new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
        return this.client;
    }

    close(): void {
        this.client = null;
    }

    async *chatCompletion(
        messages: Array<ChatMessages>,
        stream: boolean = true,
    ): AsyncGenerator<StreamEvent, void, unknown> {
        const client = this.get_client();
        const args: ChatRequest = {
            model: process.env.LLM_MODEL,
            messages,
            stream,
        };
        try {
            if (stream) {
                yield* this.stream_response(client, args);
            } else {
                yield await this.non_stream_response(client, args);
            }
            return;
        } catch (error) {
            yield this.to_error_event(error);
        }
    }

    private async *stream_response(
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
                yield { type: "text_delta", text_delta: content, finish_reason: null, usage: null };
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

    private async non_stream_response(client: OpenRouter, args: ChatRequest): Promise<StreamEvent> {
        const response = await client.chat.send({ chatRequest: { ...args, stream: false } });

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

    private to_error_event(error: unknown): StreamEvent {
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

        return { type: "error", text_delta: null, error: message, finish_reason: null, usage: null };
    }
}
