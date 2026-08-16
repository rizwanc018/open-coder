import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { MessageList } from "./components/MessageList";
import { Inputbar } from "./components/Inputbar";
import { useAgent } from "./hooks/useAgent";
import { loadConfig } from "../core/config/configLoader";
import { validateConfig, type Config } from "../core/config/config";
import { errorMessage } from "../core/utils/error";

function App({ config }: { config: Config }) {
    const { messages, isWorking, sendMessage } = useAgent(config);

    return (
        <box flexDirection="column" width="100%" height="100%">
            <MessageList messages={messages} isWorking={isWorking} />
            <Inputbar onSubmit={sendMessage} disabled={isWorking} />
        </box>
    );
}

let config: Config;
try {
    config = loadConfig();
} catch (error) {
    console.error(errorMessage(error));
    process.exit(1);
}

const configErrors = validateConfig(config);
if (configErrors.length > 0) {
    console.error(configErrors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App config={config} />);
