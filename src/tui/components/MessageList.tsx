import { TextAttributes } from "@opentui/core";
import { Header } from "./Header";
import { Spinner } from "./Spinner";
import { theme } from "../theme";
import type { UIMessage } from "../hooks/useAgent";

type MessageListProps = {
    messages: UIMessage[];
    isWorking: boolean;
};

export function MessageList({ messages, isWorking }: MessageListProps) {
    return (
        <scrollbox flexGrow={1} stickyScroll stickyStart="bottom">
            <Header />
            {messages.map((message, index) => (
                <box key={message.id} width="100%" paddingTop={1}>
                    {message.role === "user" ? (
                        <text fg={theme.user} attributes={TextAttributes.BOLD}>
                            {`❯ ${message.content}`}
                        </text>
                    ) : isWorking && !message.content && index === messages.length - 1 ? (
                        <Spinner />
                    ) : (
                        <text
                            fg={message.error ? theme.error : message.content ? theme.assistant : theme.muted}
                        >
                            {`❮ ${message.content || "..."}`}
                        </text>
                    )}
                </box>
            ))}
        </scrollbox>
    );
}
