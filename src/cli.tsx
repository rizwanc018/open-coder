import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./tui/App";
import { loadConfig } from "./core/config/configLoader";
import { userConfigFile } from "./core/config/pathLoader";
import { validateConfig, type Config } from "./core/config/config";
import { errorMessage } from "./core/utils/error";

type Options = {
    cwd: string | undefined;
    help: boolean;
    version: boolean;
};

const packageVersion = (): string => {
    try {
        const manifest = fileURLToPath(new URL("../package.json", import.meta.url));
        const pkg: unknown = JSON.parse(readFileSync(manifest, "utf8"));
        const version = (pkg as { version?: unknown }).version;
        return typeof version === "string" ? version : "unknown";
    } catch {
        return "unknown";
    }
};

const HELP = `open-coder — a terminal AI coding agent

Usage
  open-coder [options]

Options
  -C, --cwd <dir>   Run the agent against <dir> instead of the current directory
  -v, --version     Print the version and exit
  -h, --help        Print this help and exit

Configuration
  Config file       ${userConfigFile()}
  Project overrides <project>/.open-coder/config.json
  API key           OPENROUTER_API_KEY, or "apiKey" in the config file

Inside the TUI, type /help for the slash commands.`;

const parseArgs = (argv: string[]): Options => {
    const options: Options = { cwd: undefined, help: false, version: false };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;

        if (arg === "-h" || arg === "--help") {
            options.help = true;
            continue;
        }
        if (arg === "-v" || arg === "--version") {
            options.version = true;
            continue;
        }
        if (arg === "-C" || arg === "--cwd" || arg.startsWith("--cwd=")) {
            const value = arg.startsWith("--cwd=") ? arg.slice("--cwd=".length) : argv[++i];
            if (!value) throw new Error(`${arg} requires a directory`);
            options.cwd = value;
            continue;
        }

        throw new Error(`Unknown option: ${arg}\nRun 'open-coder --help' for usage.`);
    }

    return options;
};

const fail = (message: string): never => {
    console.error(message);
    process.exit(1);
};

const main = async (): Promise<void> => {
    let options: Options;
    try {
        options = parseArgs(process.argv.slice(2));
    } catch (error) {
        return fail(errorMessage(error));
    }

    if (options.help) {
        console.log(HELP);
        return;
    }
    if (options.version) {
        console.log(packageVersion());
        return;
    }

    let config: Config;
    try {
        config = loadConfig(options.cwd ? resolve(options.cwd) : undefined);
    } catch (error) {
        // A config error is usually someone's first run, so name the file to edit.
        return fail(
            `${errorMessage(error)}\n\n` +
                `Config file: ${userConfigFile()}\n` +
                `Minimal example:\n` +
                `  {"model": {"name": "anthropic/claude-sonnet-4.5"}, "apiKey": "sk-or-..."}`,
        );
    }

    const configErrors = validateConfig(config);
    if (configErrors.length > 0) {
        return fail(configErrors.map((error) => `- ${error}`).join("\n"));
    }

    const renderer = await createCliRenderer({ exitOnCtrlC: false });
    const root = createRoot(renderer);

    let shuttingDown = false;
    const shutdown = () => {
        if (shuttingDown) return;
        shuttingDown = true;
        try {
            root.unmount();
            renderer.destroy();
        } finally {
            process.exit(0);
        }
    };

    root.render(<App config={config} onExit={shutdown} />);
};

await main();
