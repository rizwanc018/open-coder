import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";

import type { ToolConfirmation } from "../../core/tools/types";
import { theme } from "../theme";
import { FileChangeView } from "./ApprovalDialog/FileChangeView.tsx";
import { CommandView } from "./ApprovalDialog/CommandView.tsx";
import { PathsView } from "./ApprovalDialog/PathsView.tsx";
import { ParamsView } from "./ApprovalDialog/ParamsView.tsx";

type ApprovalDialogProps = {
    confirmation: ToolConfirmation;
    onResolve: (approved: boolean) => void;
};

const TOOL_LABELS: Record<string, string> = {
    shell: "Shell",
    write_file: "Write File",
    edit_file: "Edit File",
};

const toolLabel = (name: string): string => TOOL_LABELS[name] ?? name;

export const ApprovalDialog = ({ confirmation, onResolve }: ApprovalDialogProps) => {
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

    const paths = (confirmation.affectedPaths ?? []).filter(
        (path): path is string => typeof path === "string",
    );

    const dangerous = confirmation.isDangerous === true;
    const hasDiff = Boolean(confirmation.diff);
    const hasCommand = typeof confirmation.command === "string" && confirmation.command.trim().length > 0;

    const isFileOperation = confirmation.toolName === "write_file" || confirmation.toolName === "edit_file";

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
            paddingX={2}
            backgroundColor={theme.background}
        >
            <box flexDirection="row">
                <text fg={dangerous ? theme.error : theme.warning} attributes={TextAttributes.BOLD}>
                    {dangerous ? "⚠ Permission required" : "Permission required"}
                </text>

                <text fg={theme.dim}>{"  "}</text>

                <text fg={theme.tool} attributes={TextAttributes.BOLD}>
                    {toolLabel(confirmation.toolName)}
                </text>
            </box>

            <text fg={theme.assistant} >
                {confirmation.description}
            </text>

            {isFileOperation && confirmation.diff && (
                <FileChangeView diff={confirmation.diff} toolName={confirmation.toolName} />
            )}

            {!isFileOperation && hasCommand && <CommandView command={confirmation.command!} />}

            <PathsView paths={paths} />

            {!hasCommand && !hasDiff && <ParamsView params={confirmation.params} />}

            {dangerous && (
                <box
                    marginTop={1}
                    flexDirection="column"
                    border
                    borderStyle="rounded"
                    borderColor={theme.error}
                    paddingX={1}
                >
                    <text fg={theme.error} attributes={TextAttributes.BOLD}>
                        {"⚠ Potentially dangerous operation"}
                    </text>

                    <text fg={theme.muted}>{"Review the operation carefully before continuing."}</text>
                </box>
            )}

            {/* Actions */}
            <box flexDirection="row" marginTop={1}>
                <text fg={theme.muted}>{"Allow? "}</text>

                <text fg={theme.success} attributes={TextAttributes.BOLD}>
                    {"[y]"}
                </text>

                <text fg={theme.muted}>{"yes  "}</text>

                <text fg={theme.error} attributes={TextAttributes.BOLD}>
                    {"[n]"}
                </text>

                <text fg={theme.muted}>{"no  "}</text>

                <text fg={theme.dim}>{"[Esc] cancel"}</text>
            </box>
        </box>
    );
};
