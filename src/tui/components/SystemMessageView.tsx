import { TextAttributes } from "@opentui/core";
import { theme } from "../theme";
import type { SystemMessage } from "../hooks/useAgent";

type SystemMessageViewProps = {
    message: SystemMessage;
};

/** Local command output. Visually distinct from `❯`/`❮` so it never reads as chat. */
export function SystemMessageView({ message }: SystemMessageViewProps) {
    const accent = message.level === "error" ? theme.error : theme.accent;

    return (
        <box flexDirection="column">
            <text fg={accent} attributes={TextAttributes.BOLD}>
                {message.title}
            </text>

            {message.lines.map((line, index) => (
                <text key={index} fg={line ? theme.muted : theme.dim}>
                    {`  ${line}`}
                </text>
            ))}
        </box>
    );
}
