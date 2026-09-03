import { PersistenceManager, snapshotOf } from "../core/agent/persistance";
import type { Session } from "../core/agent/session";
import { APPROVAL_POLICIES, type ApprovalPolicy, type Config } from "../core/config/config";
import { todos } from "../core/tools/built-in/todo";
import type { AnyTool } from "../core/tools/types";
import { formatCommand, SLASH_COMMANDS, type ParsedCommand } from "./command";

export type CommandOutput = {
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
const COMMAND_WIDTH = 20;

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

const saveSessionCommand = (ctx: CommandContext): CommandOutput => {
    new PersistenceManager().saveSession(snapshotOf(ctx.session!));
    const line = [`Session id : ${ctx.session?.sessionId!}`];
    return info("Session saved", line);
};

const TITLE_WIDTH = 60;

// Titles are raw user messages: multi-line, arbitrarily long. Collapse to a
// single clipped line so one session never blows out the list.
const titleOf = (title: string | null): string => {
    const text = title?.replace(/\s+/g, " ").trim();
    if (!text) return "(no messages)";
    return text.length > TITLE_WIDTH ? `${text.slice(0, TITLE_WIDTH - 1)}…` : text;
};

const when = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
};

const listSessionsCommand = (): CommandOutput => {
    const sessions = new PersistenceManager().listSessions();

    if (sessions.length === 0) {
        return info("/sessions", ["No saved sessions. Save the current one with /save."]);
    }

    const indexWidth = String(sessions.length).length;
    const lines = [count(sessions.length, "session")];

    sessions.forEach((session, i) => {
        const index = String(i + 1).padStart(indexWidth, " ");
        const indent = " ".repeat(indexWidth + 2);
        lines.push(
            "",
            `${index}. ${titleOf(session.title)}`,
            `${indent}Session id:  ${session.sessionId}`,
            `${indent}${count(session.turnCount, "turn")} · ${when(session.updatedAt)}`,
        );
    });

    return info("Saved sessions", lines);
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

        case "save":
            return saveSessionCommand(ctx);

        case "sessions":
            return listSessionsCommand();

        case "exit":
            ctx.exit();
            return null;

        default:
            return unknownCommand(parsed.command.name);
    }
};
