import { TextAttributes } from "@opentui/core";
import { useState } from "react";
import { theme } from "../theme";

type TodoStatus = "pending" | "in_progress" | "completed";

type Todo = {
    id: string;
    content: string;
    status: TodoStatus;
};

type TodoMetadata = {
    action: "add" | "start" | "complete" | "list" | "clear";
    todos?: Todo[];
    todo?: Todo;
};

type TodoViewProps = {
    metadata: Record<string, unknown> | undefined;
    output: string | undefined;
    status: "running" | "success" | "error";
};

const MAX_VISIBLE_TODOS = 25;
const MAX_VISIBLE_LINES = 12;

const isTodo = (value: unknown): value is Todo => {
    if (!value || typeof value !== "object") {
        return false;
    }

    const todo = value as Record<string, unknown>;

    return (
        typeof todo.id === "string" &&
        typeof todo.content === "string" &&
        (todo.status === "pending" || todo.status === "in_progress" || todo.status === "completed")
    );
};

const isTodoMetadata = (metadata: Record<string, unknown>): metadata is TodoMetadata => {
    if (
        metadata.action !== "add" &&
        metadata.action !== "start" &&
        metadata.action !== "complete" &&
        metadata.action !== "list" &&
        metadata.action !== "clear"
    ) {
        return false;
    }

    if (metadata.todo !== undefined && !isTodo(metadata.todo)) {
        return false;
    }

    if (metadata.todos !== undefined) {
        if (!Array.isArray(metadata.todos)) {
            return false;
        }

        if (!metadata.todos.every(isTodo)) {
            return false;
        }
    }

    return true;
};

const getStatusIcon = (status: TodoStatus): string => {
    switch (status) {
        case "completed":
            return "✓";

        case "in_progress":
            return "◐";

        case "pending":
            return "○";
    }
};

const getStatusColor = (status: TodoStatus): string => {
    switch (status) {
        case "completed":
            return theme.success;

        case "in_progress":
            return theme.warning;

        case "pending":
            return theme.muted;
    }
};

const getSummary = (todos: Todo[]): string => {
    const completed = todos.filter((todo) => todo.status === "completed").length;

    const inProgress = todos.filter((todo) => todo.status === "in_progress").length;

    const pending = todos.filter((todo) => todo.status === "pending").length;

    const parts: string[] = [];

    if (completed > 0) {
        parts.push(`${completed} completed`);
    }

    if (inProgress > 0) {
        parts.push(`${inProgress} in progress`);
    }

    if (pending > 0) {
        parts.push(`${pending} pending`);
    }

    return parts.join(" · ");
};

export function TodoView({ metadata, output, status }: TodoViewProps) {
    const [expanded, setExpanded] = useState(false);

    if (status === "error") {
        return (
            <box flexDirection="column">
                {(output ?? "Todo operation failed")
                    .split("\n")
                    .slice(0, 12)
                    .map((line, index) => (
                        <text key={index} fg={theme.error}>
                            {`  ${line}`}
                        </text>
                    ))}
            </box>
        );
    }

    if (!metadata || !isTodoMetadata(metadata)) {
        return null;
    }

    const todos = metadata.todos ?? [];

    if (metadata.action === "clear") {
        return (
            <box flexDirection="column">
                <text fg={theme.muted}>
                    {"  └ "}
                    <span fg={theme.success}>todos cleared</span>
                </text>
            </box>
        );
    }

    if (metadata.action === "add" || metadata.action === "start" || metadata.action === "complete") {
        if (!metadata.todo) {
            return null;
        }

        const { todo } = metadata;

        return (
            <box flexDirection="column">
                <text fg={theme.muted}>
                    {"  └ "}
                    <span fg={getStatusColor(todo.status)}>{getStatusIcon(todo.status)}</span>
                    <span fg={theme.muted}> {todo.content}</span>
                </text>
            </box>
        );
    }

    if (todos.length === 0) {
        return (
            <box flexDirection="column">
                <text fg={theme.muted}>
                    {"  └ "}
                    <span fg={theme.dim}>no todos</span>
                </text>
            </box>
        );
    }

    const visibleTodos = expanded ? todos : todos.slice(0, MAX_VISIBLE_TODOS);

    const hasMore = todos.length > MAX_VISIBLE_TODOS;

    return (
        <box flexDirection="column">
            <text fg={theme.muted}>
                {"  └ "}
                <span fg={theme.info}>
                    {todos.length} {todos.length === 1 ? "todo" : "todos"}
                </span>

                <span fg={theme.dim}>{" · "}</span>

                <span fg={theme.muted}>{getSummary(todos)}</span>
            </text>

            <box flexDirection="column" marginTop={1} marginLeft={4}>
                {visibleTodos.map((todo) => (
                    <box key={todo.id} flexDirection="row">
                        <text
                            fg={getStatusColor(todo.status)}
                            attributes={todo.status === "completed" ? TextAttributes.BOLD : undefined}
                        >
                            {getStatusIcon(todo.status)}
                        </text>

                        <text fg={theme.dim}> [{todo.id}] </text>

                        <text
                            fg={todo.status === "completed" ? theme.dim : theme.muted}
                            attributes={todo.status === "completed" ? TextAttributes.DIM : undefined}
                        >
                            {todo.content}
                        </text>
                    </box>
                ))}

                {hasMore && (
                    <text
                        fg={theme.dim}
                        onMouseDown={() => setExpanded((value) => !value)}
                        attributes={TextAttributes.UNDERLINE}
                    >
                        {expanded
                            ? "Show less"
                            : `Click to expand (${todos.length - MAX_VISIBLE_TODOS} more)`}
                    </text>
                )}
            </box>
        </box>
    );
}
