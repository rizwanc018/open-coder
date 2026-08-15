import { TextAttributes } from "@opentui/core";
import { Header } from "./Header";
import { Spinner } from "./Spinner";
import { ToolCallRow } from "./ToolCallRow";
import { theme } from "../theme";
import type { UIMessage } from "../hooks/useAgent";

type MessageListProps = {
    messages: UIMessage[];
    isWorking: boolean;
};

function renderMessage(message: UIMessage, isLast: boolean, isWorking: boolean) {
    if (message.role === "tool") {
        return <ToolCallRow message={message} />;
    }

    if (message.role === "user") {
        return (
            <text fg={theme.user} attributes={TextAttributes.BOLD}>
                {`❯ ${message.content}`}
            </text>
        );
    }

    if (isWorking && !message.content && isLast) {
        return <Spinner />;
    }

    return (
        <text fg={message.error ? theme.error : message.content ? theme.assistant : theme.muted}>
            {`❮ ${message.content || "..."}`}
        </text>
    );
}

export function MessageList({ messages, isWorking }: MessageListProps) {
    return (
        <scrollbox width="100%" flexGrow={1} flexShrink={1} stickyScroll stickyStart="bottom">
            <Header />
            {messages.map((message, index) => (
                <box key={message.id} width="100%" paddingTop={1}>
                    {renderMessage(message, index === messages.length - 1, isWorking)}
                </box>
            ))}
        </scrollbox>
    );
}
