import { TextAttributes } from "@opentui/core";
import { theme } from "../theme";
import { useState } from "react";

type GrepMetadata = {
    path: string;
    matches: number;
    filesSearched: number;
};

type GrepViewProps = {
    metadata: Record<string, unknown> | undefined;
    output: string | undefined;
    pattern: string;
    caseInsensitive: boolean;
};

type GrepMatch = {
    lineNumber: number;
    content: string;
};

type GrepFile = {
    path: string;
    matches: GrepMatch[];
};

const isGrepMetadata = (metadata: Record<string, unknown>): metadata is GrepMetadata => {
    return (
        typeof metadata.path === "string" &&
        typeof metadata.matches === "number" &&
        typeof metadata.filesSearched === "number"
    );
};

const parseOutput = (output: string): GrepFile[] => {
    const files: GrepFile[] = [];
    let currentFile: GrepFile | null = null;

    for (const line of output.split("\n")) {
        if (line.startsWith("> ")) {
            currentFile = {
                path: line.slice(2).trim(),
                matches: [],
            };

            files.push(currentFile);
            continue;
        }

        if (!currentFile) continue;

        const match = line.match(/^(\d+):(.*)$/);

        if (!match) continue;

        currentFile.matches.push({
            lineNumber: Number(match[1]),
            content: match[2]!,
        });
    }

    return files;
};

const highlightLine = (line: string, pattern: string, caseInsensitive: boolean) => {
    let regex: RegExp;

    try {
        regex = new RegExp(`(${pattern})`, caseInsensitive ? "gi" : "g");
    } catch {
        return <text fg={theme.muted}>{line}</text>;
    }

    const parts = line.split(regex);

    return (
        <span fg={theme.muted}>
            {parts.map((part, index) => {
                const isMatch = index % 2 === 1;

                return (
                    <span
                        key={`${part}-${index}`}
                        fg={isMatch ? theme.code : theme.muted}
                        attributes={isMatch ? TextAttributes.BOLD : undefined}
                    >
                        {part}
                    </span>
                );
            })}
        </span>
    );
};

const MAX_VISIBLE_LINES = 10;

export function GrepView({ metadata, output, pattern, caseInsensitive }: GrepViewProps) {
    const [expanded, setExpanded] = useState(false);

    if (!metadata || !isGrepMetadata(metadata)) {
        return null;
    }

    const { matches, filesSearched } = metadata;

    if (matches === 0) {
        return (
            <box flexDirection="column">
                <text fg={theme.muted}>
                    {"  └ "}
                    <span fg={theme.dim}>
                        no matches · searched {filesSearched} {filesSearched === 1 ? "file" : "files"}
                    </span>
                </text>
            </box>
        );
    }

    if (!output) {
        return (
            <box flexDirection="column">
                <text fg={theme.muted}>
                    {"  └ "}
                    <span fg={theme.info}>
                        {matches} {matches === 1 ? "match" : "matches"}
                    </span>
                </text>
            </box>
        );
    }

    const files = parseOutput(output);

    const visibleFiles = expanded ? files : files.slice(0, MAX_VISIBLE_LINES);
    const hasMore = files.length > MAX_VISIBLE_LINES;

    return (
        <box flexDirection="column">
            <text fg={theme.muted}>
                {"  └ "}
                <span fg={theme.info}>
                    {matches} {matches === 1 ? "match" : "matches"}
                </span>

                <span fg={theme.dim}>{" · "}</span>

                <span fg={theme.muted}>
                    searched {filesSearched} {filesSearched === 1 ? "file" : "files"}
                </span>
            </text>

            <box flexDirection="column" marginTop={1} marginLeft={4}>
                {visibleFiles.map((file) => (
                    <box key={file.path} flexDirection="column" marginBottom={1}>
                        <text fg={theme.info} attributes={TextAttributes.BOLD}>
                            {file.path}
                        </text>

                        {file.matches.map((match) => (
                            <text key={`${file.path}:${match.lineNumber}`} fg={theme.muted}>
                                <span fg={theme.dim}>{`${String(match.lineNumber).padStart(5, " ")} `}</span>
                                {pattern
                                    ? highlightLine(match.content, pattern, caseInsensitive)
                                    : match.content}
                            </text>
                        ))}
                    </box>
                ))}
                {hasMore && (
                    <text
                        fg={theme.dim}
                        onMouseDown={() => setExpanded((value) => !value)}
                        attributes={TextAttributes.UNDERLINE}
                    >
                        {expanded
                            ? "Show less"
                            : `Click to expand (${files.length - MAX_VISIBLE_LINES} more)`}
                    </text>
                )}
            </box>
        </box>
    );
}
