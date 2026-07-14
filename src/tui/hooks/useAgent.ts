import { useCallback, useEffect, useRef, useState } from "react";
import { Agent } from "../../core/agent/agent";

export type UIMessage = {
    id: number;
    role: "user" | "assistant";
    content: string;
    error?: boolean;
};

let nextId = 0;

export function useAgent() {
    const agentRef = useRef<Agent | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [isWorking, setIsWorking] = useState(false);

    const getAgent = (): Agent => {
        if (!agentRef.current) agentRef.current = new Agent();
        return agentRef.current;
    };

    useEffect(() => {
        return () => {
            abortRef.current?.abort();
            agentRef.current?.close();
            agentRef.current = null;
        };
    }, []);

    const sendMessage = useCallback(async (text: string) => {
        if (isWorking) return;

        const abort = new AbortController();
        abortRef.current = abort;
        setIsWorking(true);

        const assistantId = ++nextId;
        setMessages((prev) => [
            ...prev,
            { id: ++nextId, role: "user", content: text },
            { id: assistantId, role: "assistant", content: "" },
        ]);

        try {
            for await (const event of getAgent().run(text, abort.signal)) {
                switch (event.type) {
                    case "text_delta":
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId ? { ...m, content: m.content + event.content } : m,
                            ),
                        );
                        break;

                    case "agent_error":
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId ? { ...m, content: event.error, error: true } : m,
                            ),
                        );
                        break;

                    default:
                        break;
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Something went wrong";
            setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: message, error: true } : m)),
            );
        } finally {
            abortRef.current = null;
            setIsWorking(false);
        }
    }, [isWorking]);

    const cancel = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    return { messages, isWorking, sendMessage, cancel };
}
