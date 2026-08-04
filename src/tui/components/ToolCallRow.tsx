import { TextAttributes } from "@opentui/core";
import { theme } from "../theme";
import type { ToolMessage } from "../hooks/useAgent";
import { debug } from "../../utils/debug";

const MAX_ARGS_LENGTH = 80;

// Friendlier labels for tool calls; falls back to the raw tool name.
const TOOL_LABELS: Record<string, string> = {
    read_file: "Read",
};

const toolLabel = (name: string): string => TOOL_LABELS[name] ?? name;

const formatArguments = (args: Record<string, unknown>): string => {
    const text = Object.entries(args)
        .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
        .join(", ");
    return text.length > MAX_ARGS_LENGTH ? `${text.slice(0, MAX_ARGS_LENGTH)}…` : text;
};

const readSummary = (preview: string): string | null => {
    const lineNumbers: number[] = [];
    let total: number | null = null;

    for (const line of preview.split("\n")) {
        const showing = line.match(/^Reading lines \d+-\d+ of (\d+)/);
        if (showing) {
            debug("Showing : ", showing)
            total = Number(showing[1]);
            continue;
        }
        const match = line.match(/^\s*(\d+)\|/);
        if (match) lineNumbers.push(Number(match[1]));
    }

    if (lineNumbers.length === 0) return null;

    const first = lineNumbers[0];
    const last = lineNumbers[lineNumbers.length - 1];
    return `Reading lines ${first}-${last} of ${total ?? last} lines`;
};

type ToolCallRowProps = {
    message: ToolMessage;
};

export function ToolCallRow({ message }: ToolCallRowProps) {
    const bulletColor =
        message.status === "running"
            ? theme.muted
            : message.status === "success"
              ? theme.success
              : theme.error;

    const readLine =
        message.status === "success" && message.name === "read_file" && message.resultPreview
            ? readSummary(message.resultPreview)
            : null;

    return (
        <box flexDirection="column">
            <box flexDirection="row">
                <text fg={bulletColor}>{"● "}</text>
                <text fg={theme.tool} attributes={TextAttributes.BOLD}>
                    {toolLabel(message.name)}
                </text>
                <text fg={theme.muted}>{` (${formatArguments(message.arguments)})`}</text>
            </box>
            {message.status === "running" ? (
                <text fg={theme.muted}>{"  └ running…"}</text>
            ) : readLine ? (
                <text fg={theme.muted}>{`  └ ${readLine}`}</text>
            ) : message.resultPreview ? (
                <box flexDirection="column">
                    {message.resultPreview.split("\n").map((line, index) => (
                        <text
                            key={index}
                            fg={message.status === "error" ? theme.error : theme.muted}
                        >
                            {`  ${line}`}
                        </text>
                    ))}
                </box>
            ) : null}
        </box>
    );
}
