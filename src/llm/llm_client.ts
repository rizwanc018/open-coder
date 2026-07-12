import { OpenRouter } from "@openrouter/sdk";
import type { ChatMessages, ChatRequest } from "@openrouter/sdk/models";

export class LLMClient {
    private client: OpenRouter | null = null;

    private get_client(): OpenRouter {
        this.client ??= new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
        return this.client;
    }

    close(): void {
        this.client = null;
    }

    async chatCompletion(messages: Array<ChatMessages>, stream: boolean = true) {
        const client = this.get_client();
        const args: ChatRequest = {
            model: process.env.LLM_MODEL,
            messages,
            stream,
        };

        if (stream) {
            return this.stream_response();
        } else {
            return this.non_stream_response(client, args);
        }
    }

    async stream_response() {}

    async non_stream_response(client: OpenRouter, args: ChatRequest) {
        const response = await client.chat.send({
            chatRequest: { ...args, stream: false },
        });
        return response;
        // return response.choices[0]?.message.content ?? "";
    }
}
