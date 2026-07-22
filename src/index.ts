import { Agent } from "./core/agent/agent";
import { LLMClient } from "./core/client/llm_client";

console.log("Starting ...");

// const run = async () => {
//     const client = new LLMClient();
//     const messages = [{ role: "user" as const, content: "read index.ts" }];
//     for await (const event of client.chat_completion(messages, { stream: true })) {
//         console.log("idx", JSON.stringify(event, null, 2));
//     }
//     console.log("DONE.");
// };

const run = async () => {
    const client = new Agent();
    for await (const event of client.run("read src/index.ts")) {
        console.log(JSON.stringify(event, null, 2));
    }
    console.log("DONE.");

};

run();
