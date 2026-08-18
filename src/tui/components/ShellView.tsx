import { useState } from "react";
import type { ShellExecution } from "../../core/tools/types";
import { theme } from "../theme";
import { TextAttributes } from "@opentui/core";

type ShellViewProps = {
    execution: ShellExecution;
};

const formatDuration = (durationMs: number): string => {
    if (durationMs < 1000) {
        return `${durationMs}ms`;
    }

    return `${(durationMs / 1000).toFixed(2)}s`;
};

const getStatusColor = (execution: ShellExecution): string => {
    switch (execution.termination) {
        case "exited":
            return execution.exitCode === 0 ? theme.success : theme.error;

        case "timeout":
        case "cancelled":
            return theme.warning;

        case "spawn_failed":
            return theme.error;
    }
};

const getStatusText = (execution: ShellExecution) => {
    switch (execution.termination) {
        case "timeout":
            return "timed out";

        case "cancelled":
            return "cancelled";

        case "spawn_failed":
            return "failed to start";

        case "exited":
            return `exit code ${execution.exitCode ?? "unknown"}`;
    }
};

const getVisibleLines = (output: string, expanded: boolean): string[] => {
    const lines = output.split("\n");

    return expanded ? lines : lines.slice(0, MAX_VISIBLE_LINES);
};

const MAX_VISIBLE_LINES = 10;

export function ShellView({ execution }: ShellViewProps) {
    const [expanded, setExpanded] = useState(false);

    const statusColor = getStatusColor(execution);
    const statusText = getStatusText(execution);

    const duration = execution.termination === "exited" ? ` · ${formatDuration(execution.durationMs)}` : "";

    const stdoutLines = execution.stdout.split("\n");
    const stderrLines = execution.stderr.split("\n");

    const hasStdout = execution.stdout.length > 0;
    const hasStderr = execution.stderr.length > 0;

    const visibleStdout = getVisibleLines(execution.stdout, expanded);
    const visibleStderr = getVisibleLines(execution.stderr, expanded);

    const hasMoreStdout = stdoutLines.length > MAX_VISIBLE_LINES;
    const hasMoreStderr = stderrLines.length > MAX_VISIBLE_LINES;
    const hasMore = hasMoreStdout || hasMoreStderr;

    return (
        <box flexDirection="column">
            <text fg={statusColor}>
                {"  └ "}
                {statusText}
                <span fg={theme.dim}>{duration}</span>
            </text>
            {hasStdout ? (
                <box flexDirection="column" marginTop={1}>
                    {visibleStdout.map((line, index) => (
                        <text key={`stdout-${index}`} fg={theme.muted}>
                            {`    ${line}`}
                        </text>
                    ))}
                </box>
            ) : null}

            {hasStderr ? (
                <box flexDirection="column" marginTop={hasStdout ? 1 : 0}>
                    <text fg={theme.error}>{"    stderr"}</text>

                    {visibleStderr.map((line, index) => (
                        <text key={`stderr-${index}`} fg={theme.error}>
                            {`    ${line}`}
                        </text>
                    ))}
                </box>
            ) : null}

            {hasMore && (
                
                <text
                    fg={theme.dim}
                    onMouseDown={() => setExpanded((value) => !value)}
                    attributes={TextAttributes.UNDERLINE}
                    marginLeft={4}
                >
                    { expanded ? "Show less" : "Click to expand"}
                </text>
            )}
        </box>
    );
}
