import { getDiffColor, getDiffStats, type DiffStats } from "../../core/utils/diff";
import { theme } from "../theme";

export function DiffView({ diff }: { diff: string }) {
    const { additions, deletions }: DiffStats = getDiffStats(diff);

    return (
        <box flexDirection="column">
            <text fg={theme.muted}>{`  └ Changed ${additions} additions, ${deletions} deletions`}</text>

            <box marginTop={1} flexDirection="column">
                {diff.split("\n").map((line, index) => (
                    <text key={index} fg={getDiffColor(line)}>
                        {`    ${line}`}
                    </text>
                ))}
            </box>
        </box>
    );
}
