# Open Coder

A terminal-based AI coding agent that can inspect, modify, and reason about your codebase.

Open Coder streams model responses into a terminal UI and lets the agent use tools to work through coding tasks, with approvals for mutating operations.

Built with [Bun](https://bun.sh), [OpenTUI](https://github.com/sst/opentui), and [OpenRouter](https://openrouter.ai).

## Features

- 11 built-in tools for working with your codebase
- Custom tool discovery
- Sub-agents for codebase investigation and code review
- Approval layer for mutating operations
- Automatic context compaction
- Persistent sessions
- Checkpoints and conversation rewind
- Shell hooks
- Loop detection
- Interactive terminal UI
- Web search and web fetching

## Requirements

- [Bun](https://bun.sh) — required at runtime
- An [OpenRouter API key](https://openrouter.ai/keys)

## Install

```bash
bun install -g @rizwanc018/open-coder     # or: npm install -g @rizwanc018/open-coder
```

Or using npm:

```bash
npm install -g @rizwanc018/open-coder
```

Then run it in any project:

```bash
cd ~/code/my-project
open-coder
```

Installed with npm and don't have Bun? The launcher tells you how to get it.

You can also run Open Coder directly with:

```bash
bunx @rizwanc018/open-coder
```

## Quick Start

On the first run, Open Coder needs:

1. An OpenRouter API key
2. An OpenRouter model slug

Create a configuration file `config.json` at `~/.config/open-coder/` on Linux, `~/Library/Application Support/open-coder/` on macOS, `%LOCALAPPDATA%\open-coder\` on Windows and add:

```json
{
    "model": {
        "name": "anthropic/claude-sonnet-4.5"
    },
    "apiKey": "sk-or-..."
}
```

### CLI flags

| Flag                | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `-C`, `--cwd <dir>` | Run the agent against `<dir>` instead of the current directory |
| `-v`, `--version`   | Print the version and exit                                     |
| `-h`, `--help`      | Print usage and exit                                           |

First run needs an OpenRouter key and a model slug — see [Configuration](#configuration).

## Usage

Type a prompt and press <kbd>Enter</kbd>; the agent works until the task is done, asking for
approval before anything mutating (see [Approval & safety](#approval--safety)).

| Key                                                                 | Action                                                                                                                                          |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| <kbd>Enter</kbd>                                                    | Send the prompt                                                                                                                                 |
| <kbd>Shift</kbd>+<kbd>Enter</kbd> / <kbd>Alt</kbd>+<kbd>Enter</kbd> | Insert a newline (needs a kitty-capable terminal for Shift)                                                                                     |
| <kbd>Ctrl</kbd>+<kbd>C</kbd>                                        | Clear the input, or interrupt an in-flight turn. It does **not** quit — use `/exit`                                                             |
| <kbd>/</kbd>                                                        | Open the slash-command menu (<kbd>↑</kbd>/<kbd>↓</kbd> to move, <kbd>Tab</kbd> to complete, <kbd>Enter</kbd> to run, <kbd>Esc</kbd> to dismiss) |

The input bar grows with your text up to 5 rows, then scrolls.

## Slash commands

Defined in [src/tui/command.ts](src/tui/command.ts) and dispatched by [src/tui/commandRunner.ts](src/tui/commandRunner.ts).

| Command                | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| `/clear`               | Clear the current conversation and start a fresh session id |
| `/config`              | Show the resolved configuration                             |
| `/model [name]`        | Show or switch the OpenRouter model for this session        |
| `/approval [policy]`   | Show or change the approval policy                          |
| `/tools`               | List the tools currently exposed to the agent               |
| `/todos`               | Show the agent's current task list                          |
| `/save`                | Save the current session to disk                            |
| `/sessions`            | List saved sessions                                         |
| `/resume [id\|number]` | Restore a saved session                                     |
| `/checkpoint`          | Snapshot the session at this point                          |
| `/checkpoints`         | List checkpoints for the current session                    |
| `/rewind [id\|number]` | Restore the conversation to a checkpoint                    |
| `/exit`                | Quit                                                        |

## Configuration

Settings come from a JSON file `config.json`, loaded by [`loadConfig()`](src/core/config/configLoader.ts) from two places:

| Scope   | Location                                                                                                                        | Purpose                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| System  | `~/.config/open-coder/` on Linux, `~/Library/Application Support/open-coder/` on macOS, `%LOCALAPPDATA%\open-coder\` on Windows | Your defaults across every project |
| Project | `<project>/.open-coder/config.json`                                                                                             | Per-repo overrides                 |

Only one is needed. When both exist they are deep-merged, with the project file winning key by key.
An unparseable file is skipped with a warning rather than being fatal, but a file that parses and then fails validation aborts startup with the offending key (e.g. `model.temperature: Too big`).

The minimum config that is must to start is, model name and openrouter api key:

```json
{
    "model": { "name": "anthropic/claude-sonnet-4.5" },
    "apiKey": "sk-or-..."
}
```
Run `/config` inside the TUI to see what actually resolved.

### Example

`.open-coder/config.json`:

```json
{
    "model": {
        "name": "anthropic/claude-sonnet-4.5",
        "temperature": 1,
        "contextWindow": 500000
    },
    "maxTurns": 150,
    "approval": "on-request",
    "userInstructions": null,
    "debug": false
}
```

### Options

| Key                                | Type             | Default                          | Description                                                                                    |
| ---------------------------------- | ---------------- | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `model.name`                       | string           | —                                | **Required.** [OpenRouter model](https://openrouter.ai/models) slug.                                                           |
| `model.temperature`                | number (0–2)     | `1`                              | Sampling temperature.                                                                          |
| `model.contextWindow`              | positive int     | `500000`                         | Token budget the context manager works against.                                                |
| `apiKey`                           | string \| null   | `null`                           | **Required.** OpenRouter api key.                                                              |
| `cwd`                              | string           | current directory                | Working directory the agent operates in. Must exist. Overridden by `--cwd`.                    |
| `maxTurns`                         | positive int     | `150`                            | Cap on iterations of the agentic loop per run.                                                 |
| `developerInstructions`            | string \| null   | contents of `AGENT.md`           | System-level instructions. Auto-filled from an `AGENT.md` in the working directory if present. |
| `userInstructions`                 | string \| null   | `null`                           | Extra instructions appended on the user's behalf.                                              |
| `allowedTools`                     | string[] \| null | `null`                           | Allowlist of tool names. `null` means every registered tool.                                   |
| `approval`                         | enum             | `"on-request"`                   | See [Approval & safety](#approval--safety).                                                    |
| `shellEnvironment.disableExcludes` | boolean          | `false`                          | Pass the full environment to shell commands instead of filtering it.                           |
| `shellEnvironment.excludePatterns` | string[]         | `["*KEY*","*TOKEN*","*SECRET*"]` | Env var globs stripped before running a shell command.                                         |
| `shellEnvironment.setVars`         | record           | `{}`                             | Extra env vars injected into shell commands.                                                   |
| `hooksEnabled`                     | boolean          | `false`                          | Master switch for hooks.                                                                       |
| `hooks`                            | Hook[]           | `[]`                             | See [Hooks](#hooks).                                                                           |
| `debug`                            | boolean          | `false`                          | Enables debug behaviour.                                                                       |

### Project instructions

You can add an `AGENT.md` file to your project.

Its contents are loaded as developer instructions and can be used to describe things such as:

* Project conventions
* Architecture
* Coding standards
* Important commands
* Testing requirements

## Approval & Safety

Open Coder asks for approval before mutating operations by default.

The available policies are:

| Policy       | Behaviour                                                               |
| ------------ | ----------------------------------------------------------------------- |
| `on-request` | Ask before every mutating operation                                     |
| `auto-edit`  | Automatically approve in-workspace file edits; ask for other operations |
| `auto`       | Automatically approve unless an operation is flagged dangerous          |
| `never`      | Reject all mutating operations                                          |
| `yolo`       | Approve everything                                                      |

The default policy is:

```text
on-request
```

## Tools

| Tool                             | Kind     | Description                                                                                                                        |
| -------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `read_file`                      | read     | Reads a text file with line numbers. Supports `offset`/`limit`, rejects binary files and files over 10 MB, truncates large output. |
| `write_file`                     | write    | Creates or overwrites a file; parent directories are created automatically.                                                        |
| `edit_file`                      | write    | Exact-match string replacement. `oldString` must be unique unless `replaceAll` is set.                                             |
| `list_dir`                       | read     | Lists a directory; directories are suffixed with `/`, hidden entries excluded by default.                                          |
| `grep`                           | read     | Regex search across file contents, returning path + line number + matching line.                                                   |
| `glob`                           | read     | Finds files by glob pattern, including `**`.                                                                                       |
| `shell`                          | shell    | Runs a command in the working directory with a filtered environment; returns output, exit code and termination reason.             |
| `web_search`                     | network  | Searches the web and returns titles, URLs and snippets.                                                                            |
| `web_fetch`                      | network  | Fetches a URL; HTML is converted to plain text.                                                                                    |
| `todos`                          | memory   | Session task list the agent uses to track multi-step work.                                                                         |
| `memory`                         | memory   | Key/value store persisted across sessions in `memory.json`, injected into the system prompt on startup.                            |
| `subagent_codebase_investigator` | subagent | Read-only exploration of the codebase to answer structural questions.                                                              |
| `subagent_code_reviewer`         | subagent | Read-only review pass for bugs, smells and security issues.                                                                        |


## Sub-agents

Open Coder includes read-only sub-agents for tasks that benefit from isolated context.

Two sub-agents are included by default:

* `codebase_investigator` — explores the codebase and answers structural questions
* `code_reviewer` — reviews code for bugs, code smells, and security issues

Sub-agents have their own context and can use a restricted set of tools.


## Sessions & Checkpoints

Open Coder can persist sessions and create checkpoints.

Useful commands:

```text
/save
/sessions
/resume
/checkpoint
/checkpoints
/rewind
```

Checkpoints allow you to restore the conversation to an earlier point without losing the current session.

## Hooks

Hooks allow shell commands to run during agent lifecycle events.

| Trigger        | Extra env                                                            |
| -------------- | -------------------------------------------------------------------- |
| `before_agent` | `AI_AGENT_USER_MESSAGE`                                              |
| `after_agent`  | `AI_AGENT_USER_MESSAGE`, `AI_AGENT_RESPONSE`                         |
| `before_tool`  | `AI_AGENT_TOOL_NAME`, `AI_AGENT_TOOL_PARAMS`                         |
| `after_tool`   | `AI_AGENT_TOOL_NAME`, `AI_AGENT_TOOL_PARAMS`, `AI_AGENT_TOOL_RESULT` |
| `on_error`     | `AI_AGENT_ERROR`                                                     |


```json
{
    "hooksEnabled": true,
    "hooks": [
        {
            "name": "format-on-write",
            "trigger": "after_tool",
            "command": "[ \"$AI_AGENT_TOOL_NAME\" = write_file ] && bunx prettier --write .",
            "timeoutSec": 30
        }
    ]
}
```

## Development

```bash
git clone https://github.com/rizwanc018/open-coder.git
cd open-coder
bun install
bun run dev
```

`bun run dev` launches the TUI ([src/cli.tsx](src/cli.tsx)) in watch mode. Bun auto-loads a
`.env` from the repo root, so an `OPENROUTER_API_KEY=sk-or-...` there works for development
without touching your user config.

| Script              | Action                                        |
| ------------------- | --------------------------------------------- |
| `bun run dev`       | Run the TUI in watch mode                     |
| `bun run start`     | Run the TUI once                              |
| `bun test`          | Run the test suite                            |
| `bun run typecheck` | `tsc --noEmit`; also runs on `prepublishOnly` |

There is no build step — the package ships TypeScript source and Bun runs it directly, which is
why Bun is a runtime requirement rather than just a dev dependency.

### Debugging

Because the TUI owns the terminal, `console.log` is not suitable for debugging.

Open a second terminal and run:
```bash
tty
```

Then start Open Coder with the returned terminal device:
```bash
DEBUG_TTY=/dev/pts/3 bun run dev
```

With `DEBUG_TTY` unset, `debug()` is a no-op. For post-hoc inspection, `writelog()` appends formatted (circular-safe) output to `logs/debug.log`.

## License

[MIT](LICENSE)
