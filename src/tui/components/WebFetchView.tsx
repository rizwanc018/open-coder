import { TextAttributes } from "@opentui/core";
import { useState } from "react";
import { theme } from "../theme";

type FetchMetadata = {
    url: string;
    finalUrl: string;
    statusCode: number;
    contentType: string;
    contentLengthBytes: number | null;
    returnedChars: number;
    truncated: boolean;
    redirectCount: number;
    durationMs: number;
};

type WebFetchViewProps = {
    metadata: Record<string, unknown> | undefined;
    output: string | undefined;
};

const MAX_VISIBLE_LINES = 12;

const isFetchMetadata = (metadata: Record<string, unknown>): metadata is FetchMetadata => {
    return (
        typeof metadata.url === "string" &&
        typeof metadata.finalUrl === "string" &&
        typeof metadata.statusCode === "number" &&
        typeof metadata.contentType === "string" &&
        (metadata.contentLengthBytes === null || typeof metadata.contentLengthBytes === "number") &&
        typeof metadata.returnedChars === "number" &&
        typeof metadata.truncated === "boolean" &&
        typeof metadata.redirectCount === "number" &&
        typeof metadata.durationMs === "number"
    );
};

const formatBytes = (bytes: number | null): string => {
    if (bytes === null) {
        return "unknown size";
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDuration = (durationMs: number): string => {
    if (durationMs < 1000) {
        return `${durationMs}ms`;
    }

    return `${(durationMs / 1000).toFixed(2)}s`;
};

const getStatusColor = (statusCode: number): string => {
    if (statusCode >= 200 && statusCode < 300) {
        return theme.success;
    }

    if (statusCode >= 300 && statusCode < 400) {
        return theme.warning;
    }

    return theme.error;
};

const getStatusText = (statusCode: number): string => {
    if (statusCode >= 200 && statusCode < 300) {
        return "success";
    }

    if (statusCode >= 300 && statusCode < 400) {
        return "redirect";
    }

    return "failed";
};

const getVisibleLines = (output: string, expanded: boolean): string[] => {
    const lines = output.split("\n");

    return expanded ? lines : lines.slice(0, MAX_VISIBLE_LINES);
};

const normalizeUrl = (value: string): string => {
    try {
        const url = new URL(value);

        if (url.pathname === "/") {
            url.pathname = "";
        }

        return url.toString();
    } catch {
        return value;
    }
};

export function WebFetchView({ metadata, output }: WebFetchViewProps) {
    const [expanded, setExpanded] = useState(false);

    if (!metadata || !isFetchMetadata(metadata)) {
        return null;
    }

    const {
        url,
        finalUrl,
        statusCode,
        contentType,
        contentLengthBytes,
        returnedChars,
        truncated,
        redirectCount,
        durationMs,
    } = metadata;

    const statusColor = getStatusColor(statusCode);
    const statusText = getStatusText(statusCode);

    const lines = output?.split("\n") ?? [];
    const visibleLines = output ? getVisibleLines(output, expanded) : [];

    const hasMore = lines.length > MAX_VISIBLE_LINES;

    const redirected = normalizeUrl(url) !== normalizeUrl(finalUrl);

    return (
        <box flexDirection="column">
            {/* Request summary */}
            <text fg={statusColor}>
                {"  └ "}
                {statusCode} {statusText}
                <span fg={theme.dim}>{` · ${formatDuration(durationMs)}`}</span>
            </text>

            {redirected && (
                <box flexDirection="column" marginTop={1} marginLeft={4}>
                    <text fg={theme.code}>{finalUrl}</text>
                    <text fg={theme.dim}>{`redirected from ${url}`}</text>
                </box>
            )}

            {truncated && (
                <text fg={theme.warning} marginTop={1} marginLeft={4}>
                    {`content truncated`}
                </text>
            )}

            {visibleLines.length > 0 && (
                <box flexDirection="column" marginTop={1} marginLeft={4}>
                    {visibleLines.map((line, index) => (
                        <text key={index} fg={theme.muted}>
                            {line}
                        </text>
                    ))}

                    {expanded && truncated && (
                        <text fg={theme.warning} marginTop={1} marginLeft={4}>
                            {`... [truncated]`}
                        </text>
                    )}

                    {hasMore && (
                        <text
                            fg={theme.dim}
                            onMouseDown={() => setExpanded((value) => !value)}
                            attributes={TextAttributes.UNDERLINE}
                            marginTop={1}
                        >
                            {expanded
                                ? "Show less"
                                : `Click to expand (${lines.length - MAX_VISIBLE_LINES} more lines)`}
                        </text>
                    )}
                </box>
            )}
        </box>
    );
}
