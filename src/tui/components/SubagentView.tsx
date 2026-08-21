import { TextAttributes } from "@opentui/core";
import { theme } from "../theme";
import type { ToolMessage } from "../hooks/useAgent";

type SubagentViewProps = {
    message: ToolMessage;
};

type Termination = "goal" | "error" | "timeout" | "cancelled" | "unknown";

const MAX_RESULT_LINES = 8;

const getStringArg = (message: ToolMessage, key: string): string | null => {
    const value = message.arguments[key];
    return typeof value === "string" ? value : null;
};

const parseTermination = (output?: string): Termination => {
    const match = output?.match(/^Termination:\s*(.+)$/m);

    switch (match?.[1]?.trim()) {
        case "goal":
            return "goal";
        case "error":
            return "error";
        case "timeout":
            return "timeout";
        case "cancelled":
            return "cancelled";
        default:
            return "unknown";
    }
};

const parseTools = (output?: string): string[] => {
    const match = output?.match(/^Tools called:\s*(.+)$/m);

    if (!match || !match[1] || match[1] === "none") {
        return [];
    }

    return match[1]
        .split(",")
        .map((tool) => tool.trim())
        .filter(Boolean);
};

const getToolCounts = (tools: string[]): Map<string, number> => {
    const counts = new Map<string, number>();

    for (const tool of tools) {
        counts.set(tool, (counts.get(tool) ?? 0) + 1);
    }

    return counts;
};

const parseResult = (output?: string): string | null => {
    if (!output) return null;

    const marker = "Result:";
    const index = output.indexOf(marker);

    if (index === -1) return null;

    const result = output.slice(index + marker.length).trim();

    return result || null;
};

const terminationLabel = (termination: Termination): string => {
    switch (termination) {
        case "goal":
            return "completed";
        case "timeout":
            return "timed out";
        case "cancelled":
            return "cancelled";
        case "error":
            return "failed";
        default:
            return "finished";
    }
};

const terminationColor = (termination: Termination) => {
    switch (termination) {
        case "goal":
            return theme.success;
        case "timeout":
        case "cancelled":
            return theme.warning;
        case "error":
            return theme.error;
        default:
            return theme.muted;
    }
};

export function SubagentView({ message }: SubagentViewProps) {
    const goal = getStringArg(message, "goal");

    if (message.status === "running") {
        return (
            <box flexDirection="column">
                <text fg={theme.muted}>
                    {"  └ "}
                    <span fg={theme.info}>investigating…</span>
                </text>

                {goal && (
                    <box marginTop={1} marginLeft={4}>
                        <text fg={theme.dim}>{goal}</text>
                    </box>
                )}
            </box>
        );
    }

    const termination =
        message.status === "error"
            ? parseTermination(message.resultOutput)
            : parseTermination(message.resultOutput);

    const tools = parseTools(message.resultOutput);
    const toolCounts = getToolCounts(tools);
    const result = parseResult(message.resultOutput);

    return (
        <box flexDirection="column">
            <text fg={terminationColor(termination)}>
                {"  └ "}
                <span attributes={TextAttributes.BOLD}>{terminationLabel(termination)}</span>

                <span fg={theme.dim}>
                    {" · "}
                    {tools.length} {tools.length === 1 ? "tool call" : "tool calls"}
                </span>
            </text>

            {toolCounts.size > 0 && (
                <box flexDirection="row" marginTop={1} marginLeft={4}>
                    <text fg={theme.muted}>Tools: </text>

                    <text fg={theme.dim}>
                        {Array.from(toolCounts.entries())
                            .map(([name, count]) => `${name} ×${count}`)
                            .join(" · ")}
                    </text>
                </box>
            )}

            {result && (
                <box flexDirection="column" marginTop={1} marginLeft={4}>
                    <text fg={theme.muted} attributes={TextAttributes.BOLD}>
                        Result
                    </text>

                    {result
                        .split("\n")
                        .slice(0, MAX_RESULT_LINES)
                        .map((line, index) => (
                            <text key={index} fg={message.status === "error" ? theme.error : theme.muted}>
                                {line}
                            </text>
                        ))}

                    {result.split("\n").length > MAX_RESULT_LINES && (
                        <text fg={theme.dim}>
                            … {result.split("\n").length - MAX_RESULT_LINES} more lines
                        </text>
                    )}
                </box>
            )}
        </box>
    );
}
