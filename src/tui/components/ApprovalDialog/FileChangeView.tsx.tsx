import type { ToolConfirmation } from "../../../core/tools/types";
import { DiffView } from "../DiffView";
import { toUnifiedDiff } from "../../../core/utils/diff";
import { debug } from "../../../shared/debug";

const getFileDiffText = (
    oldContent: string,
    newContent: string,
    isNewFile = false,
    isDeletion = false,
): string => {
    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");

    if (isNewFile) {
        return newLines.map((line) => `+${line}`).join("\n");
    }

    if (isDeletion) {
        return oldLines.map((line) => `-${line}`).join("\n");
    }

    const maxLines = Math.max(oldLines.length, newLines.length);
    const result: string[] = [];

    for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i];
        const newLine = newLines[i];

        if (oldLine === newLine) {
            if (oldLine !== undefined) {
                result.push(` ${oldLine}`);
            }

            continue;
        }

        if (oldLine !== undefined) {
            result.push(`-${oldLine}`);
        }

        if (newLine !== undefined) {
            result.push(`+${newLine}`);
        }
    }

    return result.join("\n");
};

export const FileChangeView = ({
    diff,
    toolName,
}: {
    diff: NonNullable<ToolConfirmation["diff"]>;
    toolName: string;
}) => {
    const diffText = toUnifiedDiff(diff);
    const output = diff.isNewFile ? "New file" : diff.isDeletion ? "Delete file" : "File changes";

    return (
        <box flexDirection="column">
            <DiffView
                diff={diffText}
                output={output}
                toolName={toolName}
                path={diff.path}
                showMessage={false}
            />
        </box>
    );
};
