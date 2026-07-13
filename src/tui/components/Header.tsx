import { theme } from "../theme";

export function Header() {
    return (
            <box flexDirection="row" justifyContent="center" gap={0.5} alignItems="center">
                <ascii-font font="tiny" text="Open" color={theme.muted} />
                <ascii-font font="tiny" text="Coder" color={theme.accent} />
            </box>
    );
}
