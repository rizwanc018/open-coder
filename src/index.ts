import { Agent } from "./core/agent/agent";
import { loadConfig } from "./core/config/configLoader";
import { validateConfig } from "./core/config/config";

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
    const config = loadConfig();

    const errors = validateConfig(config);
    if (errors.length > 0) {
        console.error(errors.map((error) => `- ${error}`).join("\n"));
        process.exit(1);
    }

    const client = new Agent(config);
    for await (const event of client.run("read src/index.ts")) {
        console.log(JSON.stringify(event, null, 2));
    }
    console.log("DONE.");

};

run();
