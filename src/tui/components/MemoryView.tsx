import { TextAttributes } from "@opentui/core";
import { theme } from "../theme";

type MemoryEntry = {
    key: string;
    value: string;
};

type MemoryMetadata = {
    action: "set" | "get" | "delete" | "list" | "clear";
    key?: string;
    value?: string;
    found?: boolean;
    entries?: MemoryEntry[];
    count?: number;
};

type MemoryViewProps = {
    metadata: Record<string, unknown> | undefined;
    output: string | undefined;
    status: "running" | "success" | "error";
};

const isMemoryEntry = (value: unknown): value is MemoryEntry => {
    if (!value || typeof value !== "object") {
        return false;
    }

    const entry = value as Record<string, unknown>;

    return typeof entry.key === "string" && typeof entry.value === "string";
};

const isMemoryMetadata = (metadata: Record<string, unknown>): metadata is MemoryMetadata => {
    if (
        metadata.action !== "set" &&
        metadata.action !== "get" &&
        metadata.action !== "delete" &&
        metadata.action !== "list" &&
        metadata.action !== "clear"
    ) {
        return false;
    }

    if (metadata.key !== undefined && typeof metadata.key !== "string") {
        return false;
    }

    if (metadata.value !== undefined && typeof metadata.value !== "string") {
        return false;
    }

    if (metadata.found !== undefined && typeof metadata.found !== "boolean") {
        return false;
    }

    if (metadata.count !== undefined && typeof metadata.count !== "number") {
        return false;
    }

    if (metadata.entries !== undefined) {
        if (!Array.isArray(metadata.entries)) {
            return false;
        }

        if (!metadata.entries.every(isMemoryEntry)) {
            return false;
        }
    }

    return true;
};

const getActionLabel = (action: MemoryMetadata["action"]): string => {
    switch (action) {
        case "set":
            return "saved";

        case "get":
            return "retrieved";

        case "delete":
            return "deleted";

        case "list":
            return "listed";

        case "clear":
            return "cleared";
    }
};

export function MemoryView({ metadata, output, status }: MemoryViewProps) {
    if (status === "error") {
        return (
            <box flexDirection="column">
                {(output ?? "Memory operation failed")
                    .split("\n")
                    .slice(0, 12)
                    .map((line, index) => (
                        <text key={index} fg={theme.error}>
                            {`  ${line}`}
                        </text>
                    ))}
            </box>
        );
    }

    if (!metadata || !isMemoryMetadata(metadata)) {
        return null;
    }

    if (metadata.action === "clear") {
        return (
            <box flexDirection="column">
                <text fg={theme.muted}>
                    {"  └ "}
                    <span fg={theme.success}>{output ?? "memories cleared"}</span>
                </text>
            </box>
        );
    }

    if (metadata.action === "set" || metadata.action === "get" || metadata.action === "delete") {
        if (!metadata.key) {
            return null;
        }

        if (metadata.action === "get" && metadata.found === false) {
            return (
                <box flexDirection="column">
                    <text fg={theme.muted}>
                        {"  └ "}
                        <span fg={theme.warning}>memory not found</span>
                        <span fg={theme.dim}> {metadata.key}</span>
                    </text>
                </box>
            );
        }

        return (
            <box flexDirection="column">
                <text fg={theme.muted}>
                    {"  └ "}
                    <span fg={theme.success}>✓</span>
                    <span fg={theme.muted}>
                        {" "}
                        {metadata.key} {metadata.value !== undefined && ": " + metadata.value}
                    </span>
                </text>
            </box>
        );
    }

    if (metadata.action === "list") {
        const entries = metadata.entries ?? [];

        if (entries.length === 0) {
            return (
                <box flexDirection="column">
                    <text fg={theme.muted}>
                        {"  └ "}
                        <span fg={theme.dim}>no memories</span>
                    </text>
                </box>
            );
        }

        return (
            <box flexDirection="column">
                <text fg={theme.muted}>
                    {"  └ "}
                    <span fg={theme.info}>
                        {entries.length} {entries.length === 1 ? "memory" : "memories"}
                    </span>
                </text>

                <box flexDirection="column" marginTop={1} marginLeft={4}>
                    {entries.map((entry) => (
                        <box key={entry.key} flexDirection="row">
                            <text fg={theme.success}>{"• "}</text>

                            <text fg={theme.muted} attributes={TextAttributes.BOLD}>
                                {entry.key}
                            </text>

                            <text fg={theme.dim}>{": "}</text>

                            <text fg={theme.muted}>{entry.value}</text>
                        </box>
                    ))}
                </box>
            </box>
        );
    }

    return null;
}
