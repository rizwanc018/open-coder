import { LLMClient } from "./llm/llm_client";

console.log("Starting ...");

const run = async () => {
    const client = new LLMClient();
    const messages = [{ role: "user" as const, content: "how are you" }];
    for await (const event of client.chatCompletion(messages, true)) {
        console.log(JSON.stringify(event, null, 2));
    }
    
    console.log("DONE.");
};

run();
