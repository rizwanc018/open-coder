export const SLASH_COMMAND_NAMES = [
    "clear",
    "config",
    "model",
    "approval",
    "tools",
    "todos",
    "save",
    "sessions",
    "resume",
    "exit",
] as const;

export type SlashCommandName = (typeof SLASH_COMMAND_NAMES)[number];

export type SlashCommand = {
    name: SlashCommandName;
    argHint?: string;
    description: string;
};

export const SLASH_COMMANDS: readonly SlashCommand[] = [
    { name: "clear", description: "Clear the current conversation" },
    { name: "config", description: "Show current configuration" },
    { name: "model", argHint: "[name]", description: "Show or change the AI model" },
    { name: "approval", argHint: "[policy]", description: "Show or change approval policy" },
    { name: "tools", description: "List tools available to the agent" },
    { name: "todos", description: "Show current task list" },
    { name: "save", description: "Save the current session" },
    { name: "sessions", description: "List saved sessions" },
    { name: "resume", argHint: "[Id|number]", description: "Resume a saved session" },
    { name: "exit", description: "Quit the application" },
];

export type ParsedCommand =
    | { kind: "known"; command: SlashCommand; args: string }
    | { kind: "unknown"; name: string };

const COMMAND_LINE = /^\/([a-zA-Z][\w-]*)(?:\s+([\s\S]*))?$/;

const COMMAND_PREFIX = /^\/([a-zA-Z][\w-]*)?$/;

const findCommand = (name: string): SlashCommand | undefined =>
    SLASH_COMMANDS.find((command) => command.name === name.toLowerCase());

export function parseCommand(text: string): ParsedCommand | null {
    const match = COMMAND_LINE.exec(text.trim());
    if (!match) return null;

    const name = match[1]!;
    const command = findCommand(name);

    return command ? { kind: "known", command, args: (match[2] ?? "").trim() } : { kind: "unknown", name };
}

export function commandPrefix(text: string): string | null {
    const match = COMMAND_PREFIX.exec(text);
    return match ? (match[1] ?? "") : null;
}

export function filterCommands(prefix: string): SlashCommand[] {
    const query = prefix.toLowerCase();
    return SLASH_COMMANDS.filter((command) => command.name.startsWith(query));
}

export function formatCommand(command: SlashCommand): string {
    return command.argHint ? `/${command.name} ${command.argHint}` : `/${command.name}`;
}

export function completionText(command: SlashCommand): string {
    return command.argHint ? `/${command.name} ` : `/${command.name}`;
}
