import { useCallback, useEffect, useRef, useState } from "react";
import { Agent } from "../../core/agent/agent";
import type { Config } from "../../core/config/config";
import { debug, writelog } from "../../shared/debug";
import { toUnifiedDiff } from "../../core/utils/diff";
import type { ShellExecution, ToolConfirmation } from "../../core/tools/types";
import data from "../../../logs/message.json";
import type { CompactionState } from "../components/CompactionStatusView";

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
    metadata?: Record<string, unknown>;
    status: "running" | "success" | "error";
    resultOutput?: string;
    diff?: string;
    shell?: ShellExecution;
};

export type UIMessage = TextMessage | ToolMessage;

let nextId = 0;

export function useAgent(config: Config) {
    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [isWorking, setIsWorking] = useState(false);
    const [compaction, setCompaction] = useState<CompactionState>({ status: "idle" });
    const [approvalRequest, setApprovalRequest] = useState<ToolConfirmation | null>(null);

    const agentRef = useRef<Promise<Agent> | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const approvalResolver = useRef<((approved: boolean) => void) | null>(null);



    const requestApproval = useCallback(
        (confirmation: ToolConfirmation) =>
            new Promise<boolean>((resolve) => {
                debug({ confirmation });
                approvalResolver.current = resolve;
                setApprovalRequest(confirmation);
            }),
        [],
    );

    const resolveApproval = useCallback((approved: boolean) => {
        approvalResolver.current?.(approved);
        approvalResolver.current = null;
        setApprovalRequest(null);
    }, []);

    // Cache the promise rather than the resolved Agent: concurrent callers then
    // share one in-flight construction instead of racing to create two.
    const getAgent = (): Promise<Agent> => {
        agentRef.current ??= Agent.create(config, requestApproval);
        return agentRef.current;
    };

    useEffect(() => {
        return () => {
            approvalResolver.current?.(false);
            approvalResolver.current = null;
            setApprovalRequest(null);

            abortRef.current?.abort();
            agentRef.current?.then((agent) => agent.close()).catch(() => {});
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
            setCompaction({ status: "idle" });

            const userId = ++nextId;
            const firstAssistantId = ++nextId;
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
                for await (const event of (await getAgent()).run(text, abort.signal)) {
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

                        case "compaction_start":
                            setCompaction({ status: "compacting" });
                            break;

                        case "compaction_end":
                            setCompaction({
                                status: event.ok ? "completed" : "failed",
                            });
                            break;

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
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.role === "tool" && m.callId === event.callId
                                        ? {
                                              ...m,
                                              metadata: event.result.metadata,
                                              status: event.result.success ? "success" : "error",
                                              resultOutput: event.result.success
                                                  ? event.result.output?.trim()
                                                  : event.result.error?.trim(),
                                              ...(event.result.diff !== undefined && {
                                                  diff: toUnifiedDiff(event.result.diff),
                                              }),
                                              ...(event.result.shell && {
                                                  shell: event.result.shell,
                                              }),
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

    return {
        messages,
        isWorking,
        compaction,
        sendMessage,
        cancel,
        approvalRequest,
        resolveApproval,
    };
}
