// CompactionStatus.tsx

import { TextAttributes } from "@opentui/core";
import { theme } from "../theme";
import { Spinner } from "./Spinner";

export type CompactionState =
    | { status: "idle" }
    | { status: "compacting" }
    | { status: "completed" }
    | { status: "failed" };

type CompactionStatusProps = {
    state: CompactionState;
};

export function CompactionStatus({ state }: CompactionStatusProps) {
    if (state.status === "idle") {
        return null;
    }

    if (state.status === "compacting") {
        return (
            <box flexDirection="row" paddingTop={1}>
                <Spinner />
                <text fg={theme.muted}> Compaction </text>
                <text fg={theme.dim}>· </text>
                <text fg={theme.muted}>compressing conversation context…</text>
            </box>
        );
    }

    if (state.status === "completed") {
        return (
            <box flexDirection="row" paddingTop={1}>
                <text fg={theme.success}>✓ </text>
                <text fg={theme.muted}>Context compacted</text>
                <text fg={theme.dim}> · continuing</text>
            </box>
        );
    }

    return (
        <box flexDirection="row" paddingTop={1}>
            <text fg={theme.error}>✕ </text>
            <text fg={theme.error} attributes={TextAttributes.BOLD}>
                Context compaction failed
            </text>
            <text fg={theme.dim}> · continuing with existing context</text>
        </box>
    );
}
