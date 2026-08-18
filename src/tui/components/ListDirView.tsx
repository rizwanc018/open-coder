import { TextAttributes } from "@opentui/core";
import { theme } from "../theme";
import { useState } from "react";

type ListDirEntry = {
    name: string;
    type: "file" | "directory";
};

type ListDirMetadata = {
    path: string;
    totalEntries: number;
    offset: number;
    limit: number;
    returnedCount: number;
    hasMore: boolean;
    entries: ListDirEntry[];
};

type ListDirViewProps = {
    metadata: Record<string, unknown>;
};

const isListDirMetadata = (metadata: Record<string, unknown>): metadata is ListDirMetadata => {
    if (
        typeof metadata.path !== "string" ||
        typeof metadata.totalEntries !== "number" ||
        typeof metadata.offset !== "number" ||
        typeof metadata.limit !== "number" ||
        typeof metadata.returnedCount !== "number" ||
        typeof metadata.hasMore !== "boolean" ||
        !Array.isArray(metadata.entries)
    ) {
        return false;
    }

    return metadata.entries.every(
        (entry) =>
            typeof entry === "object" &&
            entry !== null &&
            "name" in entry &&
            "type" in entry &&
            typeof entry.name === "string" &&
            (entry.type === "file" || entry.type === "directory"),
    );
};

const MAX_VISIBLE_LINES = 15;

export function ListDirView({ metadata }: ListDirViewProps) {
    const [expanded, setExpanded] = useState(false);

    if (!isListDirMetadata(metadata)) {
        return null;
    }

    const { totalEntries, offset, returnedCount, entries } = metadata;

    if (totalEntries === 0) {
        return (
            <box flexDirection="column">
                <text fg={theme.muted}>
                    {"  └ "}
                    <span fg={theme.dim}>empty directory</span>
                </text>
            </box>
        );
    }

    if (returnedCount === 0) {
        return (
            <box flexDirection="column">
                <text fg={theme.muted}>
                    {"  └ "}
                    <span fg={theme.warning}>no entries at offset {offset}</span>
                </text>
            </box>
        );
    }

    const firstEntry = offset + 1;
    const lastEntry = offset + returnedCount;

    const visibleEntries = expanded ? entries : entries.slice(0, MAX_VISIBLE_LINES);
    const hasMoreEntries = entries.length > MAX_VISIBLE_LINES;

    return (
        <box flexDirection="column">
            <text fg={theme.muted}>
                {"  └ "}
                <span fg={theme.info}>
                    Total {totalEntries} {totalEntries === 1 ? "entry" : "entries"}
                </span>

                <span fg={theme.dim}>{" · "}</span>

                <span fg={theme.muted}>
                    showing {firstEntry}–{lastEntry} of {totalEntries}
                </span>
            </text>

            <box flexDirection="column" marginTop={1} marginLeft={4}>
                {visibleEntries.map((entry) => (
                    <box key={`${entry.type}-${entry.name}`} flexDirection="row">
                        <text
                            fg={entry.type === "directory" ? theme.info : theme.code}
                            attributes={entry.type === "directory" ? TextAttributes.BOLD : TextAttributes.DIM}
                        >
                            {entry.name}
                            {entry.type === "directory" ? "/" : ""}
                        </text>
                    </box>
                ))}
                {hasMoreEntries && (
                    <text
                        fg={theme.dim}
                        onMouseDown={() => setExpanded((value) => !value)}
                        attributes={TextAttributes.UNDERLINE}
                    >
                        {expanded
                            ? "Show less"
                            : `Click to expand (${entries.length - MAX_VISIBLE_LINES} more)`}{" "}
                    </text>
                )}
            </box>
        </box>
    );
}
