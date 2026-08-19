import { TextAttributes } from "@opentui/core";
import { useState } from "react";
import { theme } from "../theme";

type SearchResult = {
    title: string;
    url: string;
    snippet: string;
};

type WebSearchMetadata = {
    query: string;
    resultCount: number;
};

type WebSearchViewProps = {
    metadata: Record<string, unknown> | undefined;
    output: string | undefined;
};

const MAX_VISIBLE_RESULTS = 5;

const isWebSearchMetadata = (metadata: Record<string, unknown>): metadata is WebSearchMetadata => {
    return typeof metadata.query === "string" && typeof metadata.resultCount === "number";
};

const parseOutput = (output: string): SearchResult[] => {
    const results: SearchResult[] = [];

    let current: SearchResult | null = null;

    for (const line of output.split("\n")) {
        const resultMatch = line.match(/^\[(\d+)\]\s+(.+)$/);
        if (resultMatch) {
            if (current) {
                results.push(current);
            }

            current = {
                title: resultMatch[2]!,
                url: "",
                snippet: "",
            };

            continue;
        }

        if (!current) continue;

        if (line.startsWith("URL: ")) {
            current.url = line.slice(5).trim();
            continue;
        }

        if (line.startsWith("Snippet: ")) {
            current.snippet = line.slice(9).trim();
        }
    }

    if (current) {
        results.push(current);
    }

    return results;
};

export function WebSearchView({ metadata, output }: WebSearchViewProps) {
    const [expanded, setExpanded] = useState(false);

    if (!metadata || !isWebSearchMetadata(metadata)) {
        return null;
    }

    const { resultCount } = metadata;

    if (resultCount === 0) {
        return (
            <box flexDirection="column">
                <text fg={theme.muted}>
                    {"  └ "}
                    <span fg={theme.dim}>no results found</span>
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
                        {resultCount} {resultCount === 1 ? "result" : "results"}
                    </span>
                </text>
            </box>
        );
    }

    const results = parseOutput(output);

    const visibleResults = expanded ? results : results.slice(0, MAX_VISIBLE_RESULTS);

    const hasMore = results.length > MAX_VISIBLE_RESULTS;

    return (
        <box flexDirection="column">
            <box flexDirection="column" marginTop={1} marginLeft={4}>
                {visibleResults.map((result, index) => (
                    <box key={`${result.url}-${index}`} flexDirection="column" marginBottom={1}>
                        <text fg={theme.info} attributes={TextAttributes.BOLD}>
                            {`[${index + 1}] ${result.title}`}
                        </text>

                        <text fg={theme.code}>{`    ${result.url}`}</text>

                        {result.snippet && <text fg={theme.muted}>{`    ${result.snippet}`}</text>}
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
                            : `Click to expand (${results.length - MAX_VISIBLE_RESULTS} more)`}
                    </text>
                )}
            </box>
        </box>
    );
}
