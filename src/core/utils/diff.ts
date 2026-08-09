import { createTwoFilesPatch } from "diff";


export interface FileDiff {
  path: string;
  oldContent: string;
  newContent: string;
  isNewFile?: boolean;
  isDeletion?: boolean;
}

export function toUnifiedDiff(diff: FileDiff): string {
  const oldName = diff.isNewFile ? "/dev/null(new-file)" : diff.path;
  const newName = diff.isDeletion ? "/dev/null(file-del)" : diff.path;

  return createTwoFilesPatch(
    oldName,
    newName,
    diff.oldContent,
    diff.newContent,
    undefined,
    undefined,
    { context: 3 },
  );
}

export function diffStats(diff: FileDiff): { added: number; removed: number } {
  let added = 0;
  let removed = 0;

  for (const line of toUnifiedDiff(diff).split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) added++;
    else if (line.startsWith("-") && !line.startsWith("---")) removed++;
  }

  return { added, removed };
}
