import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { useRef, useState } from "react";
import { Agent } from "../core/agent/agent";
import { MessageList, type UIMessage } from "./components/MessageList";
import { Inputbar } from "./components/Inputbar";

let nextMessageId = 0;

function App() {
    const agentRef = useRef<Agent | null>(null);
    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    const getAgent = () => {
        if (!agentRef.current) agentRef.current = new Agent();
        return agentRef.current;
    };

    const appendToLast = (delta: string, error = false) => {
        setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            return [...prev.slice(0, -1), { ...last, content: last.content + delta, error }];
        });
    };

    const handleSubmit = async (text: string) => {
        if (isRunning || !text) return;
        setIsRunning(true);

        setMessages((prev) => [
            ...prev,
            { id: nextMessageId++, role: "user", content: text },
            { id: nextMessageId++, role: "assistant", content: "" },
        ]);

        try {
            for await (const event of getAgent().run(text)) {
                switch (event.type) {
                    case "text_delta":
                        appendToLast(event.content);
                        break;
                    case "agent_error":
                        appendToLast(event.error, true);
                        break;
                    default:
                        break;
                }
            }
        } catch (err) {
            appendToLast(err instanceof Error ? err.message : String(err), true);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <box
            alignItems="center"
            flexGrow={1}
            position="relative"
            width="100%"
            height="100%"
            paddingTop={1}
        >
            <MessageList messages={messages} />
            <Inputbar onSubmit={handleSubmit} disabled={isRunning} />
        </box>
    );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
