import { TextAttributes } from "@opentui/core";
import { useEffect } from "react";
import { useKeyboard } from "@opentui/react";
import type { ToolConfirmation } from "../../core/tools/types";
import { theme } from "../theme";

type ApprovalDialogProps = {
    confirmation: ToolConfirmation;
    onResolve: (approved: boolean) => void;
};

const TOOL_LABELS: Record<string, string> = {
    shell: "Shell",
    write_file: "Write",
    edit_file: "Edit",
    delete_file: "Delete",
};

const toolLabel = (name: string): string => TOOL_LABELS[name] ?? name;

const truncate = (value: string, max = 100): string => {
    if (value.length <= max) return value;
    return `${value.slice(0, max - 1)}…`;
};

export function ApprovalDialog({ confirmation, onResolve }: ApprovalDialogProps) {
    useEffect(() => {
        // Approval dialogs should always start in a neutral state.
        // The default action is denial if the user simply presses Enter.
    }, [confirmation]);

    useKeyboard((key) => {
        switch (key.name) {
            case "y":
                onResolve(true);
                break;

            case "n":
            case "escape":
                onResolve(false);
                break;
        }
    });

    const command = typeof confirmation.command === "string" ? confirmation.command : null;

    const paths = Array.isArray(confirmation.affectedPaths)
        ? confirmation.affectedPaths.filter((path): path is string => typeof path === "string")
        : [];

    const dangerous = confirmation.isDangerous === true;

    return (
        <box
            position="absolute"
            left={2}
            right={2}
            bottom={3}
            flexDirection="column"
            border
            borderStyle="rounded"
            borderColor={dangerous ? theme.error : theme.warning}
            paddingX={1}
        >
            <text fg={dangerous ? theme.error : theme.warning} attributes={TextAttributes.BOLD}>
                {dangerous ? "⚠ Permission required" : "Permission required"}
            </text>

            <text fg={theme.muted} marginTop={1}>
                {`${toolLabel(confirmation.toolName)} wants to perform an operation:`}
            </text>

            {command && (
                <box flexDirection="column" marginTop={1}>
                    {command.split("\n").map((line, index) => (
                        <text key={index} fg={theme.assistant}>
                            {`$ ${truncate(line)}`}
                        </text>
                    ))}
                </box>
            )}

            {paths.length > 0 && (
                <box flexDirection="column" marginTop={1}>
                    <text fg={theme.muted}>{"Affected paths:"}</text>

                    {paths.slice(0, 6).map((path) => (
                        <text key={path} fg={theme.muted}>
                            {`  • ${truncate(path)}`}
                        </text>
                    ))}

                    {paths.length > 6 && <text fg={theme.dim}>{`  …and ${paths.length - 6} more`}</text>}
                </box>
            )}

            {!command && paths.length === 0 && (
                <box flexDirection="column" marginTop={1}>
                    <text fg={theme.muted}>{"Parameters:"}</text>

                    {Object.entries(confirmation.params ?? {}).map(([key, value]) => (
                        <text key={key} fg={theme.muted}>
                            {`  ${key}: ${truncate(
                                typeof value === "string" ? value : JSON.stringify(value),
                            )}`}
                        </text>
                    ))}
                </box>
            )}

            {dangerous && (
                <text fg={theme.error} marginTop={1}>
                    {"This operation is potentially dangerous."}
                </text>
            )}

            <box flexDirection="row" marginTop={1}>
                <text fg={theme.muted}>{"Allow? "}</text>
                <text fg={theme.success} attributes={TextAttributes.BOLD}>
                    {"[y]"}
                </text>
                <text fg={theme.muted}>{" yes  "}</text>
                <text fg={theme.error} attributes={TextAttributes.BOLD}>
                    {"[n]"}
                </text>
                <text fg={theme.muted}>{" no  "}</text>
                <text fg={theme.dim}>{"[Esc] cancel"}</text>
            </box>
        </box>
    );
}
