/**
 * Executes slash commands.
 *
 * Everything here runs entirely client-side: no command reaches the model, adds a
 * message to `ContextManager`, or costs a token. That invariant is the whole point
 * of the feature — the naive alternative is to send `/tools` to the LLM and ask it
 * to introspect, which burns a turn and gets the answer wrong.
 */

import type { Session } from "../core/agent/session";
import { APPROVAL_POLICIES, type ApprovalPolicy, type Config } from "../core/config/config";
import { todos } from "../core/tools/built-in/todo";
import type { AnyTool } from "../core/tools/types";
import { debug } from "../shared/debug";
import { formatCommand, SLASH_COMMANDS, type ParsedCommand } from "./command";

export type CommandOutput = {
    /** Echoed as the block heading, e.g. `/model gpt-4o`. */
    title: string;
    lines: string[];
    level: "info" | "error";
};

export type CommandContext = {
    session: Session | null;
    ensureSession: () => Promise<Session>;
    config: Config;
    clearConversation: () => void;
    exit: () => void;
};

const LABEL_WIDTH = 16;
/** Wider, because `/approval [policy]` overflows the settings column. */
const COMMAND_WIDTH = 20;

/** Two-column line. Guarantees a gap even when the label overflows the column. */
const row = (label: string, value: string, width = LABEL_WIDTH): string =>
    `${label}${" ".repeat(Math.max(1, width - label.length))}${value}`;

const count = (n: number, singular: string): string => `${n} ${singular}${n === 1 ? "" : "s"}`;

const num = (value: number): string => value.toLocaleString("en-US");

const info = (title: string, lines: string[]): CommandOutput => ({ title, lines, level: "info" });

const error = (title: string, lines: string[]): CommandOutput => ({ title, lines, level: "error" });

const configLines = (config: Config): string[] => {
    return [
        row("model", config.model.name),
        row("temperature", String(config.model.temperature)),
        row("context window", `${num(config.model.contextWindow)} tokens`),
        row("approval", config.approval),
        row("max turns", String(config.maxTurns)),
        row("cwd", config.cwd),
        row("hooks", config.hooksEnabled ? `enabled (${count(config.hooks.length, "hook")})` : "disabled"),
        row("allowed tools", config.allowedTools ? config.allowedTools.join(", ") : "all"),
        row("debug", config.debug ? "on" : "off"),
    ];
};

const modelCommand = (args: string, ctx: CommandContext): CommandOutput => {
    const { config, session } = ctx;

    if (!args) {
        return info("/model", [
            row("model", config.model.name),
            row("temperature", String(config.model.temperature)),
            row("context window", `${num(config.model.contextWindow)} tokens`),
            "",
            "Switch with /model <name>, e.g. /model anthropic/claude-sonnet-4.5",
        ]);
    }

    // A model id is a single opaque token; anything with whitespace is a typo, and
    // silently sending it to the API just yields a confusing 400 on the next turn.
    if (/\s/.test(args)) {
        return error("/model", [`Model names cannot contain spaces: "${args}"`]);
    }

    const previous = config.model.name;
    if (args === previous) {
        return info("/model", [`Already using ${previous}.`]);
    }

    if (!session) {
        // The agent is built lazily from `config`, so writing it here is still correct.
        config.model.name = args;
    } else {
        session.setModel(args);
    }

    return info("/model", [
        `model → ${args}`,
        row("previously", previous),
        "",
        `Context window is still ${num(config.model.contextWindow)} tokens. If the new model's`,
        "window differs, set model.contextWindow in your config — compaction is",
        "calibrated against that number, not against the model.",
    ]);
};

const approvalCommand = (args: string, ctx: CommandContext): CommandOutput => {
    const { config, session } = ctx;
    const current = session?.approvalPolicy ?? config.approval;

    if (!args) {
        return info("/approval", [
            row("policy", current),
            row("available", APPROVAL_POLICIES.join(", ")),
            "",
            "Change with /approval <policy>.",
        ]);
    }

    const policy = args.toLowerCase();
    if (!APPROVAL_POLICIES.includes(policy as ApprovalPolicy)) {
        return error("/approval", [
            `Unknown approval policy: "${args}"`,
            row("available", APPROVAL_POLICIES.join(", ")),
        ]);
    }

    if (policy === current) {
        return info("/approval", [`Already set to ${current}.`]);
    }

    if (session) {
        session.setApprovalPolicy(policy as ApprovalPolicy);
    } else {
        config.approval = policy as ApprovalPolicy;
    }

    const lines = [`approval → ${policy}`, row("previously", current)];

    if (policy === "yolo") {
        lines.push("", "Every tool call now runs unprompted, including destructive ones.");
    } else if (policy === "never") {
        lines.push("", "All mutating tool calls will be rejected outright.");
    }

    return info("/approval", lines);
};

const toolsCommand = (tools: AnyTool[]): CommandOutput => {
    if (tools.length === 0) {
        return info("/tools", ["No tools available."]);
    }

    const byKind = new Map<string, string[]>();
    for (const tool of tools) {
        const names = byKind.get(tool.kind) ?? [];
        names.push(tool.name);
        byKind.set(tool.kind, names);
    }
    const lines = [count(tools.length, "tool"), ""];
    for (const [kind, names] of byKind) {
        lines.push(row(kind, names.sort().join(", ")));
    }

    return info("/tools", lines);
};

const todosCommand = (): CommandOutput => {
    const items = todos.list();

    if (items.length === 0) {
        return info("/todos", ["No todos."]);
    }

    const tally = { completed: 0, in_progress: 0, pending: 0 };
    for (const todo of items) tally[todo.status]++;

    const summary = [
        tally.completed > 0 && `${tally.completed} completed`,
        tally.in_progress > 0 && `${tally.in_progress} in progress`,
        tally.pending > 0 && `${tally.pending} pending`,
    ].filter((part): part is string => Boolean(part));

    const icon = { completed: "✓", in_progress: "◐", pending: "○" } as const;

    return info("/todos", [
        `${count(items.length, "todo")} · ${summary.join(" · ")}`,
        "",
        ...items.map((todo) => `${icon[todo.status]} [${todo.id}] ${todo.content}`),
    ]);
};

const unknownCommand = (name: string): CommandOutput => {
    return error(`/${name}`, [
        `Unknown command: /${name}`,
        "",
        ...SLASH_COMMANDS.map((command) => row(formatCommand(command), command.description, COMMAND_WIDTH)),
    ]);
};

export const runSlashCommand = async (
    parsed: ParsedCommand,
    ctx: CommandContext,
): Promise<CommandOutput | null> => {
    if (parsed.kind === "unknown") {
        return unknownCommand(parsed.name);
    }

    const { args } = parsed;

    switch (parsed.command.name) {
        case "clear":
            ctx.clearConversation();
            ctx.session?.reset();
            return info("/clear", ["Conversation cleared."]);

        case "config":
            return info("/config", configLines(ctx.config));

        case "model":
            return modelCommand(args, ctx);

        case "approval":
            return approvalCommand(args, ctx);

        case "tools":
            return toolsCommand((await ctx.ensureSession()).tools);

        case "todos":
            return todosCommand();

        case "exit":
            ctx.exit();
            return null;
    }
};
