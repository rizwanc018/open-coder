import { TextAttributes } from "@opentui/core";
import { theme } from "../../theme";

export const PathsView = ({ paths }: { paths: string[] }) => {
    if (paths.length === 0) {
        return null;
    }

    return (
        <box flexDirection="column" marginTop={1}>
            <text fg={theme.muted} attributes={TextAttributes.BOLD}>
                {"Affected paths"}
            </text>

            {paths.map((path) => (
                <text key={path} fg={theme.assistant}>
                    {`  • ${path}`}
                </text>
            ))}
        </box>
    );
};
