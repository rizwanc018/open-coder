import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import { MessageList } from "./components/MessageList";
import { Inputbar } from "./components/Inputbar";
import { useAgent } from "./hooks/useAgent";
import { loadConfig } from "../core/config/configLoader";
import { validateConfig, type Config } from "../core/config/config";
import { errorMessage } from "../core/utils/error";
import { ApprovalDialog } from "./components/ApprovalDialog";
import { useTransientNotice } from "./hooks/useTransientNotice";

type AppProps = {
    config: Config;
    onExit: () => void;
};

const EXIT_HINT = "Type /exit to quit.";

const App = ({ config, onExit }: AppProps) => {
    const { messages, isWorking, sendMessage, compaction, approvalRequest, resolveApproval, cancel } =
        useAgent(config);
    const { notice, showNotice } = useTransientNotice();

    const handleSubmit = (text: string) => {
        const command = text.trim();

        if (command === "/exit") {
            cancel();
            onExit();
            return;
        }

        void sendMessage(text);
    };

    useKeyboard((key) => {
        if (!key.ctrl || key.name !== "c") return;

        if (approvalRequest) {
            resolveApproval(false);
            showNotice(`Tool denied. ${EXIT_HINT}`);
            return;
        }

        if (isWorking) {
            cancel();
            showNotice(`Chat canceled. ${EXIT_HINT}`);
            return;
        }

        showNotice(EXIT_HINT);
    });

    return (
        <box flexDirection="column" width="100%" height="100%">
            <MessageList messages={messages} isWorking={isWorking} compaction={compaction} />
            <Inputbar onSubmit={handleSubmit} disabled={isWorking} notice={notice} />
            {approvalRequest && <ApprovalDialog confirmation={approvalRequest} onResolve={resolveApproval} />}
        </box>
    );
};

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

// exitOnCtrlC alone is enough: in raw mode ISIG is off, so Ctrl+C arrives as a
// keypress, not SIGINT. Leave exitSignals at its default so a real signal
// (SIGHUP, SIGTERM, a crash) still restores the terminal on the way out.
const renderer = await createCliRenderer({
    exitOnCtrlC: false,
});

const root = createRoot(renderer);

let shuttingDown = false;

const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    root.unmount();
    renderer.destroy();
    process.exit(0)
};

root.render(<App config={config} onExit={shutdown} />);
