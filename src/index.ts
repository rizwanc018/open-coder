import { Agent } from "./core/agent/agent";
import { LLMClient } from "./core/client/llm_client";

console.log("Starting ...");

// const run = async () => {
//     const client = new LLMClient();
//     const messages = [{ role: "user" as const, content: "how are you" }];
//     for await (const event of client.chat_completion(messages, true)) {
//         console.log("idx",JSON.stringify(event, null, 2));
//     }
//     console.log("DONE.");
// };

const run = async () => {
    const client = new Agent();
    const messages = [{ role: "user" as const, content: "how are you" }];
    for await (const event of client.run("how are you")) {
        console.log("idx",JSON.stringify(event, null, 2));
    }
    console.log("DONE.");
};

run();
