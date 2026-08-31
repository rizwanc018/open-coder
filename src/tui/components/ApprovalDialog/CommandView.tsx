import { TextAttributes } from "@opentui/core";
import { theme } from "../../theme";

export const CommandView = ({ command }: { command: string }) => {
    if (!command.trim()) {
        return null;
    }

    return (
        <box flexDirection="column" marginTop={1}>
            <text fg={theme.muted} attributes={TextAttributes.BOLD}>
                {"Command"}
            </text>

            <box
                marginTop={1}
                flexDirection="column"
                border
                borderStyle="rounded"
                borderColor={theme.border}
                paddingX={1}
            >
                {command.split("\n").map((line, index) => (
                    <text key={index} fg={theme.code}>
                        {`$ ${line}`}
                    </text>
                ))}
            </box>
        </box>
    );
};
