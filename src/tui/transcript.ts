import type { ChatMessages } from "@openrouter/sdk/models";
import type { MessageItem } from "../core/context/types";
import { COMPACTION_MARKER, INTERRUPTED_RESULT, UNFINISHED_RESULT } from "../core/context/manager";
import type { UIMessage } from "./hooks/useAgent";


const textOf = (content: ChatMessages["content"]): string => {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content
        .map((part) => (typeof part === "object" && part && "text" in part ? String(part.text) : ""))
        .join("");
};

const argumentsOf = (json: string): Record<string, unknown> => {
    try {
        const parsed: unknown = JSON.parse(json);
        return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
    } catch {
        return {};
    }
};

const SYNTHETIC_RESULTS = new Set([INTERRUPTED_RESULT, UNFINISHED_RESULT]);


export function toUIMessages(items: MessageItem[], nextId: () => number): UIMessage[] {
    const results = new Map<string, string>();
    for (const { message } of items) {
        if (message.role === "tool" && message.toolCallId) {
            results.set(message.toolCallId, textOf(message.content));
        }
    }

    const ui: UIMessage[] = [];

    for (const { message } of items) {
        if (message.role === "user") {
            const content = textOf(message.content);

            if (content.startsWith(COMPACTION_MARKER)) {
                ui.push({
                    id: nextId(),
                    role: "system",
                    title: "Context compacted",
                    lines: ["Earlier turns were replaced by a summary to stay within the window."],
                    level: "info",
                });
                continue;
            }

            ui.push({ id: nextId(), role: "user", content });
            continue;
        }

        if (message.role !== "assistant") continue;

        const content = textOf(message.content);
        if (content) ui.push({ id: nextId(), role: "assistant", content });

        for (const call of message.toolCalls ?? []) {
            const output = results.get(call.id);
            ui.push({
                id: nextId(),
                role: "tool",
                callId: call.id,
                name: call.function.name,
                arguments: argumentsOf(call.function.arguments),
                status: output !== undefined && !SYNTHETIC_RESULTS.has(output) ? "success" : "interrupted",
                ...(output !== undefined && { resultOutput: output.trim() }),
            });
        }
    }

    return ui;
}
