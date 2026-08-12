import { TextAttributes } from "@opentui/core";
import { theme } from "../theme";
import type { ToolMessage } from "../hooks/useAgent";
import { RGBA, SyntaxStyle } from "@opentui/core";
import { DiffView } from "./DiffView";

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

    for (const line of preview.split("\n")) {
        const showing = line.match(/^Reading lines \d+-\d+ of (\d+)/);
        if (showing) {
            return showing[0];
        }
        const match = line.match(/^\s*(\d+)\|/);
        if (match) lineNumbers.push(Number(match[1]));
    }

    if (lineNumbers.length === 0) return null;

    const first = lineNumbers[0];
    const last = lineNumbers[lineNumbers.length - 1];
    return `Reading lines ${first}-${last}`;
};

type ToolCallRowProps = {
    message: ToolMessage;
};

const syntaxStyle = SyntaxStyle.fromStyles({
    default: { fg: RGBA.fromHex("#E6EDF3") },
    string: { fg: RGBA.fromHex("#A5D6FF") },
    keyword: { fg: RGBA.fromHex("#FF7B72"), bold: true },
});

export function ToolCallRow({ message }: ToolCallRowProps) {
    const bulletColor =
        message.status === "running"
            ? theme.muted
            : message.status === "success"
              ? theme.success
              : theme.error;

    const readLine =
        message.status === "success" && message.name === "read_file" && message.resultOutput
            ? readSummary(message.resultOutput)
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
            ) : message.diff ? (
                <DiffView diff={message.diff} />
            ) : readLine ? (
                <text fg={theme.muted}>{`  └ ${readLine}`}</text>
            ) : message.resultOutput ? (
                <box flexDirection="column">
                    {message.resultOutput.split("\n").map((line, index) => (
                        <text key={index} fg={message.status === "error" ? theme.error : theme.muted}>
                            {`  ${line}`}
                        </text>
                    ))}
                </box>
            ) : null}
        </box>
    );
}
