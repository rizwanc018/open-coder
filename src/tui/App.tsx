import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { MessageList } from "./components/MessageList";
import { Inputbar } from "./components/Inputbar";
import { useAgent } from "./hooks/useAgent";

function App() {
    const { messages, isWorking, sendMessage } = useAgent();

    return (
        <box alignItems="center" flexGrow={1} position="relative" width="100%" height="100%" paddingTop={1}>
            <MessageList messages={messages} isWorking={isWorking} />
            <Inputbar onSubmit={sendMessage} disabled={isWorking} />
            
        </box>
    );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
