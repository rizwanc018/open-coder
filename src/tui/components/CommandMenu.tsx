import { TextAttributes } from "@opentui/core";
import { theme } from "../theme";
import { formatCommand, type SlashCommand } from "../command";

type CommandMenuProps = {
    commands: SlashCommand[];
    selectedIndex: number;
};

const NAME_WIDTH = 27;

export function CommandMenu({ commands, selectedIndex }: CommandMenuProps) {
    return (
        <box
            flexDirection="column"
            border
            borderStyle="rounded"
            borderColor={theme.border}
            backgroundColor={theme.background}
            paddingX={1}
        >
            {commands.map((command, index) => {
                const selected = index === selectedIndex;
                const label = formatCommand(command);

                return (
                    <text
                        key={command.name}
                        fg={selected ? theme.highlight : theme.muted}
                        attributes={selected ? TextAttributes.BOLD : undefined}
                    >
                        {`${selected ? "❯ " : "  "}${label.padEnd(NAME_WIDTH)}`}
                        <span fg={selected ? theme.assistant : theme.dim}>{command.description}</span>
                    </text>
                );
            })}

            <text fg={theme.dim}>{"  ↑↓ select · tab complete · enter run · esc dismiss"}</text>
        </box>
    );
}
