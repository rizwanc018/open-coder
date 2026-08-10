import { useCallback, useEffect, useRef, useState } from "react";
import { Agent } from "../../core/agent/agent";
import type { Config } from "../../core/config/config";
import type { ToolResult } from "../../core/tools/types";
import { debug, writelog } from "../../utils/debug";

export type TextMessage = {
    id: number;
    role: "user" | "assistant";
    content: string;
    error?: boolean;
};

export type ToolMessage = {
    id: number;
    role: "tool";
    callId: string;
    name: string;
    arguments: Record<string, unknown>;
    status: "running" | "success" | "error";
    resultPreview?: string;
};

export type UIMessage = TextMessage | ToolMessage;

let nextId = 0;

const toResultPreview = (result: ToolResult): string => {
    const text = result.success ? result.output : (result.error ?? result.output);
    return text.trim();
};

export function useAgent(config: Config) {
    const agentRef = useRef<Agent | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [isWorking, setIsWorking] = useState(false);

    const getAgent = (): Agent => {
        if (!agentRef.current) agentRef.current = new Agent(config);
        return agentRef.current;
    };

    useEffect(() => {
        return () => {
            abortRef.current?.abort();
            agentRef.current?.close();
            agentRef.current = null;
        };
    }, []);

    // Debug
    useEffect(() => {
        writelog("w", "logs/messages.log", messages);
    }, [messages]);

    const sendMessage = useCallback(
        async (text: string) => {
            if (isWorking) return;

            const abort = new AbortController();
            abortRef.current = abort;
            setIsWorking(true);

            const userId = ++nextId;
            const firstAssistantId = ++nextId;
            // Each loop iteration gets its own assistant bubble; null means the next
            // text_delta should open a fresh one.
            let assistantId: number | null = firstAssistantId;

            setMessages((prev) => [
                ...prev,
                { id: userId, role: "user", content: text },
                { id: firstAssistantId, role: "assistant", content: "" },
            ]);

            const appendErrorMessage = (content: string) => {
                const id = ++nextId;
                assistantId = null;
                setMessages((prev) => [...prev, { id, role: "assistant", content, error: true }]);
            };

            try {
                for await (const event of getAgent().run(text, abort.signal)) {
                    switch (event.type) {
                        case "text_delta": {
                            if (assistantId === null) {
                                const id = ++nextId;
                                assistantId = id;
                                setMessages((prev) => [
                                    ...prev,
                                    { id, role: "assistant", content: event.content },
                                ]);
                            } else {
                                const id = assistantId;
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === id && m.role === "assistant"
                                            ? { ...m, content: m.content + event.content }
                                            : m,
                                    ),
                                );
                            }
                            break;
                        }

                        case "tool_call_start": {
                            const id = ++nextId;
                            assistantId = null;
                            setMessages((prev) => [
                                ...prev,
                                {
                                    id,
                                    role: "tool",
                                    callId: event.callId,
                                    name: event.name,
                                    arguments: event.arguments,
                                    status: "running",
                                },
                            ]);
                            break;
                        }

                        case "tool_call_complete": {
                            debug(">>> event : ", event);
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.role === "tool" && m.callId === event.callId
                                        ? {
                                              ...m,
                                              status: event.result.success ? "success" : "error",
                                              resultPreview: toResultPreview(event.result),
                                          }
                                        : m,
                                ),
                            );
                            break;
                        }

                        case "agent_error":
                            appendErrorMessage(event.error);
                            break;

                        default:
                            break;
                    }
                }
            } catch (err) {
                appendErrorMessage(err instanceof Error ? err.message : "Something went wrong");
            } finally {
                // Drop assistant bubbles that never received text (e.g. a turn that
                // produced only tool calls).
                setMessages((prev) => prev.filter((m) => !(m.role === "assistant" && m.content === "")));
                abortRef.current = null;
                setIsWorking(false);
            }
        },
        [isWorking],
    );

    const cancel = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    return { messages, isWorking, sendMessage, cancel };
}
