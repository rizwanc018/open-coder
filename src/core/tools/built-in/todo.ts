import z from "zod";
import { defineTool, err, ok, TOOL_KIND, type AnyTool } from "../types";
import { randomUUID } from "node:crypto";

export type TodoStatus = "pending" | "in_progress" | "completed";

export interface Todo {
    id: string;
    content: string;
    status: TodoStatus;
}

class TodoStore {
    private readonly todos = new Map<string, Todo>();

    add(content: string): Todo {
        const todo: Todo = {
            id: randomUUID().slice(0, 8),
            content,
            status: "pending",
        };
        this.todos.set(todo.id, todo);
        return todo;
    }

    get(id: string): Todo | undefined {
        return this.todos.get(id);
    }

    start(id: string): Todo | null {
        const todo = this.todos.get(id);
        if (!todo) return null;
        if (todo.status === "completed") return null;
        todo.status = "in_progress";
        return todo;
    }

    complete(id: string): Todo | null {
        const todo = this.todos.get(id);
        if (!todo) return null;
        if (todo.status === "completed") return null;
        todo.status = "completed";
        return todo;
    }

    list(): Todo[] {
        return [...this.todos.values()];
    }

    clear(): number {
        const count = this.todos.size;
        this.todos.clear();
        return count;
    }
}

const todos = new TodoStore();

// const schema = z.object({
//     action: z.enum(["add", "start", "complete", "list", "clear"]).describe("The operation to perform"),
//     id: z.string().optional().describe("Todo id (required for start/complete)"),
//     content: z.string().optional().describe("Todo text (required for add)"),
// });

const schema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("add"),
        content: z.string().trim().min(1).describe("Todo text"),
    }),
    z.object({
        action: z.literal("start"),
        id: z.string().trim().min(8).describe("Todo id"),
    }),
    z.object({
        action: z.literal("complete"),
        id: z.string().trim().min(8).describe("Todo id"),
    }),
    z.object({
        action: z.literal("list"),
    }),
    z.object({
        action: z.literal("clear"),
    }),
]);

export const todostool = defineTool({
    name: "todos",
    description:
        "Manage a task list for the current session. Use this to track progress on multi-step tasks.",
    kind: TOOL_KIND.Memory,
    schema,

    async execute(input, ctx) {
        switch (input.action) {
            case "add": {
                if (!input.content) return err("`content` is required for the 'add' action");
                const todo = todos.add(input.content);
                return ok(`Added todo [${todo.id}]: ${todo.content}`, {
                    metadata: {
                        action: "add",
                        todo,
                    },
                });
            }

            case "start": {
                const todo = todos.get(input.id);
                if (!todo) return err(`Todo not found: ${input.id}`);

                if (todo.status === "completed")
                    return err(`Cannot start completed todo [${input.id}]: ${todo.content}`);

                todos.start(input.id);
                return ok(`Started todo [${todo.id}]: ${todo.content}`, {
                    metadata: {
                        action: "start",
                        todo,
                    },
                });
            }
            case "complete": {
                const todo = todos.get(input.id);
                if (!todo) return err(`Todo not found: ${input.id}`);

                if (todo.status === "completed") {
                    return ok(`Todo already completed [${todo.id}]: ${todo.content}`);
                }
                todos.complete(input.id);
                return ok(`Completed todo [${todo.id}]: ${todo.content}`, {
                    metadata: {
                        action: "add",
                        todo,
                    },
                });
            }

            case "list": {
                const items = todos.list();

                if (items.length === 0) {
                    return ok("No todos", {
                        metadata: {
                            action: "list",
                            todos: [],
                        },
                    });
                }

                const lines = ["Todos:"];

                for (const todo of items) {
                    const mark =
                        todo.status === "completed" ? "x" : todo.status === "in_progress" ? "~" : " ";
                    lines.push(`  [${mark}] [${todo.id}] ${todo.content}`);
                }
                return ok(lines.join("\n"), {
                    metadata: {
                        action: "list",
                        todos: items,
                    },
                });
            }

            case "clear": {
                const count = todos.clear();
                return ok(`Cleared ${count} todos`);
            }
        }
    },
});
