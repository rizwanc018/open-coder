import { TextAttributes } from "@opentui/core";
import { theme } from "../theme";
import type { ToolMessage } from "../hooks/useAgent";
import { debug } from "../../shared/debug";

const MAX_ARGS_LENGTH = 80;

const TOOL_LABELS: Record<string, string> = {
    read_file: "Read",
    write_file: "Write",
};

const toolLabel = (name: string): string => TOOL_LABELS[name] ?? name;

const truncateStart = (text: string): string =>
    text.length > MAX_ARGS_LENGTH ? `…${text.slice(text.length - MAX_ARGS_LENGTH)}` : text;

const formatArguments = (name: string, args: Record<string, unknown>): string => {
    if (name === "read_file" || name === "write_file") {
        const path = args["path"];
        if (typeof path === "string") return truncateStart(path);
    }
    return truncateStart(JSON.stringify(args) ?? String(args));
};

const readSummary = (preview: string): string | null => {
    const lineNumbers: number[] = [];
    let total: number | null = null;

    for (const line of preview.split("\n")) {
        const showing = line.match(/^Reading lines \d+-\d+ of (\d+)/);
        if (showing) {
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
                <text fg={theme.muted}>{` (${formatArguments(message.name, message.arguments)})`}</text>
            </box>
            {message.status === "running" ? (
                <text fg={theme.muted}>{"  └ running…"}</text>
            ) : readLine ? (
                <text fg={theme.muted}>{`  └ ${readLine}`}</text>
            ) : message.resultPreview ? (
                <box flexDirection="column">
                    {message.resultPreview.split("\n").map((line, index) => (
                        <text key={index} fg={message.status === "error" ? theme.error : theme.muted}>
                            {`  ${line}`}
                        </text>
                    ))}
                </box>
            ) : null}
        </box>
    );
}
