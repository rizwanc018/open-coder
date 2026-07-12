import { LLMClient } from "./llm/llm_client";

console.log("Starting ...");

const run = async () => {
    const client = new LLMClient();
    const messages = [{ role: "user" as const, content: "how are you" }];
    const response = await client.chatCompletion(messages, false);
    console.log(JSON.stringify(response, null, 2));
    console.log("DONE.");
};

run();
