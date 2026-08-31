import { TextAttributes } from "@opentui/core";
import { theme } from "../../theme";

const formatValue = (value: unknown): string => {
    if (typeof value === "string") {
        return value;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const truncate = (value: string, max = 120): string => {
    if (value.length <= max) {
        return value;
    }

    return `${value.slice(0, max - 1)}…`;
};

export const ParamsView = ({ params }: { params: Record<string, unknown> }) => {
    const entries = Object.entries(params);

    if (entries.length === 0) {
        return null;
    }

    return (
        <box flexDirection="column" marginTop={1}>
            <text fg={theme.muted} attributes={TextAttributes.BOLD}>
                {"Parameters"}
            </text>

            {entries.map(([key, value]) => (
                <box key={key} flexDirection="row">
                    <text fg={theme.accent}>{`  ${key}: `}</text>

                    <text fg={theme.assistant}>{truncate(formatValue(value))}</text>
                </box>
            ))}
        </box>
    );
};
