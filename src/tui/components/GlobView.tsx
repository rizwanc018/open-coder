import { TextAttributes } from "@opentui/core";
import { theme } from "../theme";
import { useState } from "react";

type GlobMetadata = {
    path: string;
    pattern: string;
    matches: number;
    truncated: boolean;
};

type GlobViewProps = {
    metadata: Record<string, unknown> | undefined;
    output: string | undefined;
};

const isGlobMetadata = (metadata: Record<string, unknown>): metadata is GlobMetadata => {
    return (
        typeof metadata.path === "string" &&
        typeof metadata.pattern === "string" &&
        typeof metadata.matches === "number" &&
        typeof metadata.truncated === "boolean"
    );
};

const MAX_VISIBLE_LINES = 10;

export function GlobView({ metadata, output }: GlobViewProps) {
    const [expanded, setExpanded] = useState(false);

    if (!metadata || !isGlobMetadata(metadata)) {
        return null;
    }

    const { matches, truncated } = metadata;

    if (matches === 0) {
        return (
            <box flexDirection="column">
                <text fg={theme.muted}>
                    {"  └ "}
                    <span fg={theme.dim}>no files matched</span>
                </text>
            </box>
        );
    }

    const files = output
        ? output
              .split("\n")
              .filter(Boolean)
              .filter((line) => !line.startsWith("... ["))
        : [];

    const visibleFiles = expanded ? files : files.slice(0, MAX_VISIBLE_LINES);

    const hasMore = files.length > MAX_VISIBLE_LINES;

    return (
        <box flexDirection="column">
            <text fg={theme.muted}>
                {"  └ "}

                <span fg={theme.info}>
                    {matches} {matches === 1 ? "file" : "files"}
                </span>

                {truncated && (
                    <>
                        <span fg={theme.dim}>{" · "}</span>
                        <span fg={theme.warning}>results truncated</span>
                    </>
                )}
            </text>


            {visibleFiles.length > 0 && (
                <box flexDirection="column" marginTop={1} marginLeft={4}>
                    {visibleFiles.map((file) => (
                        <text key={file} fg={theme.muted}>
                            {file}
                        </text>
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
            )}
        </box>
    );
}
