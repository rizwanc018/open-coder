import { TextAttributes } from "@opentui/core";
import { Header } from "./Header";
import { Spinner } from "./Spinner";
import { ToolCallRow } from "./ToolCallRow";
import { theme } from "../theme";
import type { UIMessage } from "../hooks/useAgent";
import { CompactionStatus, type CompactionState } from "./CompactionStatusView";
import { SystemMessageView } from "./SystemMessageView";

type MessageListProps = {
    messages: UIMessage[];
    isWorking: boolean;
    compaction: CompactionState;
};

function renderMessage(message: UIMessage, isLast: boolean, isWorking: boolean, compaction: CompactionState) {
    if (message.role === "tool") {
        return <ToolCallRow message={message} />;
    }

    if (message.role === "system") {
        return <SystemMessageView message={message} />;
    }

    if (message.role === "user") {
        return (
            <text fg={theme.user} attributes={TextAttributes.BOLD}>
                {`❯ ${message.content}`}
            </text>
        );
    }

    if (isWorking && !message.content && isLast && compaction.status === "idle") {
        return <Spinner />;
    }

    return (
        <text fg={message.error ? theme.error : message.content ? theme.assistant : theme.muted}>
            {`❮ ${message.content || "..."}`}
        </text>
    );
}

export function MessageList({ messages, isWorking, compaction }: MessageListProps) {
    return (
        <scrollbox width="100%" flexGrow={1} flexShrink={1} stickyScroll stickyStart="bottom">
            <Header />
            {messages.map((message, index) => (
                <box key={message.id} width="100%" paddingTop={1}>
                    {renderMessage(message, index === messages.length - 1, isWorking, compaction)}
                </box>
            ))}
            {(compaction.status === "compacting" || compaction.status === "completed") && (
                <CompactionStatus state={compaction} />
            )}
        </scrollbox>
    );
}
