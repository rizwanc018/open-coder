import { TextAttributes } from "@opentui/core";
import { Header } from "./Header";
import { theme } from "../theme";

export type UIMessage = {
    id: number;
    role: "user" | "assistant";
    content: string;
    error?: boolean;
};

type MessageListProps = {
    messages: UIMessage[];
};

export function MessageList({ messages }: MessageListProps) {
    return (
        <scrollbox flexGrow={1} stickyScroll stickyStart="bottom">
            <Header />
            {messages.map((message) => (
                <box key={message.id} width="100%" paddingTop={1}>
                    {message.role === "user" ? (
                        <text fg={theme.user} attributes={TextAttributes.BOLD}>
                            {`❯ ${message.content}`}
                        </text>
                    ) : (
                        <text fg={message.error ? theme.error : message.content ? theme.assistant : theme.muted}>
                            {message.content || "..."}
                        </text>
                    )}
                </box>
            ))}
        </scrollbox>
    );
}
