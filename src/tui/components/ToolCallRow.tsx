import { TextAttributes } from "@opentui/core";
import { theme } from "../theme";
import type { ToolMessage } from "../hooks/useAgent";
import { DiffView } from "./DiffView";
import { ShellView } from "./ShellView";
import { ListDirView } from "./ListDirView";
import { GrepView } from "./GrepView";
import { GlobView } from "./GlobView";
import { WebSearchView } from "./WebSearchView";
import { WebFetchView } from "./WebFetchView";
import { TodoView } from "./TodoView";
import { MemoryView } from "./MemoryView";
import { debug } from "../../shared/debug";

const MAX_ARGS_LENGTH = 100;
const MAX_VISIBLE_LINES = 12;

const TOOL_LABELS: Record<string, string> = {
    read_file: "Read",
    write_file: "Write",
    edit_file: "Edit",
    list_dir: "List",
    shell: "Shell",
    grep: "Grep",
    glob: "Glob",
    web_search: "Web Search",
    web_fetch: "Fetch",
    todos: "Todos",
    memory: "Memory",
};

const toolLabel = (name: string): string => TOOL_LABELS[name] ?? name;

const truncateStart = (text: string): string =>
    text.length > MAX_ARGS_LENGTH ? `…${text.slice(text.length - MAX_ARGS_LENGTH)}` : text;

const getValueOf = (args: Record<string, unknown>, key: string) => {
    return typeof args[key] === "string" ? (args[key] as string) : null;
};

const formatArguments = (name: string, args: Record<string, unknown>): string => {
    let argValue;

    if (name === "read_file" || name === "write_file" || name === "edit_file" || name === "list_dir") {
        argValue = getValueOf(args, "path");
    } else if (name === "shell") {
        argValue = getValueOf(args, "command");
    } else if (name === "shell") {
        argValue = getValueOf(args, "command");
    } else if (name === "grep" || name === "glob") {
        argValue = "path: ";
        argValue += getValueOf(args, "path");
        argValue += ", pattern: ";
        argValue += `"${getValueOf(args, "pattern")}" `;
    } else if (name === "web_search") {
        argValue = `"${getValueOf(args, "query")}"`;
    } else if (name === "web_fetch") {
        argValue = `"${getValueOf(args, "url")}"`;
    } else if (name === "memory") {
        argValue = getValueOf(args, "action")?.toUpperCase();
        const key = getValueOf(args, "key");
        const value = getValueOf(args, "value");
        if (value) argValue += ` {${key}:"${value}"}`;
        else if (key) argValue += ` "${key}" `;
    } else if (name === "todos") {
        argValue = "action: ";
        argValue += getValueOf(args, "action");
        argValue += ", content: ";
        argValue += `"${getValueOf(args, "content")}" `;
    }
    if (argValue) return truncateStart(argValue);
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
            ) : message.name === "shell" && message.shell ? (
                <ShellView execution={message.shell} />
            ) : message.name === "grep" ? (
                <GrepView
                    metadata={message.metadata}
                    output={message.resultOutput}
                    pattern={getValueOf(message.arguments, "pattern")!}
                    caseInsensitive={getValueOf(message.arguments, "caseInsensitive") === "true"}
                />
            ) : message.name === "glob" ? (
                <GlobView metadata={message.metadata} output={message.resultOutput} />
            ) : message.name === "list_dir" && message.metadata ? (
                <ListDirView metadata={message.metadata} />
            ) : message.diff ? (
                <DiffView
                    diff={message.diff}
                    output={message.resultOutput}
                    toolName={message.name}
                    path={getValueOf(message.arguments, "path")}
                />
            ) : message.name === "web_search" ? (
                <WebSearchView metadata={message.metadata} output={message.resultOutput} />
            ) : message.name === "web_fetch" ? (
                <WebFetchView metadata={message.metadata} output={message.resultOutput} />
            ) : message.name === "todos" ? (
                <TodoView metadata={message.metadata} output={message.resultOutput} status={message.status} />
            ) : message.name === "memory" ? (
                <MemoryView
                    metadata={message.metadata}
                    output={message.resultOutput}
                    status={message.status}
                />
            ) : readLine ? (
                <text fg={theme.muted}>{`  └ ${readLine}`}</text>
            ) : message.resultOutput ? (
                <box flexDirection="column">
                    {message.resultOutput
                        .split("\n")
                        .slice(0, MAX_VISIBLE_LINES)
                        .map((line, index) => (
                            <text key={index} fg={message.status === "error" ? theme.error : theme.muted}>
                                {`  ${line}`}
                            </text>
                        ))}
                </box>
            ) : null}
        </box>
    );
}
