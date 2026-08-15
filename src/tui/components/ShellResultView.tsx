import type { ShellExecution } from "../../core/tools/types";
import { theme } from "../theme";

type ShellResultViewProps = {
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

export function ShellResultView({ execution }: ShellResultViewProps) {
    const statusColor = getStatusColor(execution);
    const statusText = getStatusText(execution);

    const duration = execution.termination === "exited" ? ` · ${formatDuration(execution.durationMs)}` : "";

    const hasStdout = execution.stdout.length > 0;
    const hasStderr = execution.stderr.length > 0;

    return (
        <box flexDirection="column">
            <text fg={statusColor}>
                {"  └ "}
                {statusText}
                <span fg={theme.dim}>{duration}</span>
            </text>
            {hasStdout ? (
                <box flexDirection="column" marginTop={1}>
                    {execution.stdout.split("\n").map((line, index) => (
                        <text key={`stdout-${index}`} fg={theme.muted}>
                            {`    ${line}`}
                        </text>
                    ))}
                </box>
            ) : null}

            {hasStderr ? (
                <box flexDirection="column" marginTop={hasStdout ? 1 : 0}>
                    <text fg={theme.error}>{"    stderr"}</text>

                    {execution.stderr.split("\n").map((line, index) => (
                        <text key={`stderr-${index}`} fg={theme.error}>
                            {`    ${line}`}
                        </text>
                    ))}
                </box>
            ) : null}
        </box>
    );
}
