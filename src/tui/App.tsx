import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { MessageList } from "./components/MessageList";
import { Inputbar } from "./components/Inputbar";
import { useAgent } from "./hooks/useAgent";
import { loadConfig } from "../core/config/configLoader";
import { validateConfig, type Config } from "../core/config/config";
import { errorMessage } from "../core/utils/error";
import { ApprovalDialog } from "./components/ApprovalDialog";

function App({ config }: { config: Config }) {
    const conf = {
        toolName: "write_file",
        description: "Create file: /home/rizwan/Desktop/open-coder/ello.js",
        params: {
            path: "ello.js",
            content: "console.log('ello js');\n",
        },
        diff: {
            path: "/home/rizwan/Desktop/open-coder/ello.js",
            oldContent: "",
            newContent: "console.log('ello js');\n",
            isNewFile: true,
        },
        affectedPaths: ["/home/rizwan/Desktop/open-coder/ello.js"],
        isDangerous: false,
    };

    const { messages, isWorking, sendMessage, compaction, approvalRequest, resolveApproval } =
        useAgent(config);
    return (
        <box flexDirection="column" width="100%" height="100%">
            <MessageList messages={messages} isWorking={isWorking} compaction={compaction} />
            <Inputbar onSubmit={sendMessage} disabled={isWorking} />
            {true && <ApprovalDialog confirmation={conf} onResolve={resolveApproval} />}
            {/* {approvalRequest && <ApprovalDialog confirmation={approvalRequest} onResolve={resolveApproval} />} */}
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
