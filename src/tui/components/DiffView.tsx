import { getDiffStats, type DiffStats } from "../../core/utils/diff";
import { FILE_TYPES } from "../../core/utils/file";
import { theme } from "../theme";

import { SyntaxStyle, RGBA } from "@opentui/core";

const syntaxStyle = SyntaxStyle.fromStyles({
    default: { fg: RGBA.fromHex("#E6EDF3") },
    string: { fg: RGBA.fromHex("#A5D6FF") },
    keyword: { fg: RGBA.fromHex("#FF7B72"), bold: true },
});

export function DiffView({
    diff,
    output,
    toolName,
    path,
    showMessage = true,
}: {
    diff: string;
    output: string | undefined;
    toolName: "write_file" | "edit_file" | string;
    path: string | null;
    showMessage?: boolean;
}) {
    const view = toolName === "edit_file" ? "split" : "unified";
    const { additions, deletions }: DiffStats = getDiffStats(diff);
    const onelinemessage = output ? output : ` ${additions} additions, ${deletions} deletions`;
    const extension = path?.split(".").pop()?.toLowerCase();
    const filetype = FILE_TYPES[extension ?? ""] ?? "text";

    return (
        <box flexDirection="column">
            {showMessage && <text fg={theme.muted}>{`  └  ${onelinemessage}`}</text>}

            <box marginTop={1} flexDirection="column">
                <diff diff={diff} filetype={filetype} syntaxStyle={syntaxStyle} view={view} />
            </box>
        </box>
    );
}
