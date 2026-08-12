import { createTwoFilesPatch } from "diff";
import { theme } from "../../tui/theme";

export interface FileDiff {
    path: string;
    oldContent: string;
    newContent: string;
    isNewFile?: boolean;
    isDeletion?: boolean;
}

export type DiffStats = {
    additions: number;
    deletions: number;
};

export function toUnifiedDiff(diff: FileDiff): string {
    const oldName = diff.isNewFile ? "/dev/null" : diff.path;
    const newName = diff.isDeletion ? "/dev/null" : diff.path;

    const patch = createTwoFilesPatch(
        oldName,
        newName,
        diff.oldContent,
        diff.newContent,
        undefined,
        undefined,
        {
            context: 3,
        },
    );

    return patch
        .split("\n")
        .filter(
            (line) =>
                line !== "===================================================================" &&
                line !== "\\ No newline at end of file",
        )
        .join("\n");
}

export const getDiffColor = (line: string): string => {
    if (line.startsWith("+") || line.startsWith("+++")) return theme.added;
    if (line.startsWith("-") || line.startsWith("---")) return theme.removed;
    if (line.startsWith("@@")) return theme.tool;
    return theme.muted;
};

export const getDiffStats = (diff: string): DiffStats => {
    let additions = 0;
    let deletions = 0;
    for (const line of diff.split("\n")) {
        if (line.startsWith("+++") || line.startsWith("---")) continue;

        if (line.startsWith("+")) additions++;
        else if (line.startsWith("-")) deletions++;
    }

    return { additions, deletions };
};
