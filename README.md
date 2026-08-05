# Open Coder

A terminal-based AI coding agent. It streams model responses into a TUI, lets the model call tools to inspect your codebase, and feeds the results back into the conversation until the task is done.

Built with [Bun](https://bun.sh), [OpenTUI](https://github.com/sst/opentui) (React renderer), and [OpenRouter](https://openrouter.ai) for model access.

## Requirements

- [Bun](https://bun.sh) (the project uses Bun's runtime, and TypeScript support)
- An [OpenRouter](https://openrouter.ai/keys) API key

## Setup

```bash
bun install
```

Create a `.env` in the project root:

```bash
OPENROUTER_API_KEY=sk-or-...
```

For now API KEY is read from .env

## Configuration

Settings come from a JSON file  `config.json`, loaded by [`loadConfig()`](src/core/config/configLoader.ts) from two places:

| Scope | Location | Purpose |
| --- | --- | --- |
| System | `~/.config/open-coder/config.json` on linux,  `~/Library/Application Support/open-coder/` on macOS, `%LOCALAPPDATA%\open-coder\` on Windows  | Your defaults across every project |
| Project | `<project>/.open-coder/config.json` | Per-repo overrides |

Only one is needed. When both exist they are deep-merged, with the project file winning key by key. 
An unparseable file is skipped with a warning rather than being fatal, but a file that parses and then fails validation aborts startup with the offending key (e.g. `model.temperature: Too big`).

### Example

Create the project config:


`.open-coder/config.json`:

```json
{
    "model": {
        "name": "anthropic/claude-sonnet-4.5",
        "temperature": 1,
        "contextWindow": 500000
    },
    "maxTurns": 150,
    "userInstructions": null,
    "debug": false
}
```

`model.name` is the only required field — any model slug [OpenRouter](https://openrouter.ai/models) supports. The smallest valid config is:

```json
{ "model": { "name": "anthropic/claude-sonnet-4.5" } }
```

### Options

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `model.name` | string | — | **Required.** OpenRouter model slug. |
| `model.temperature` | number (0–2) | `1` | Sampling temperature. |
| `model.contextWindow` | positive int | `500000` | Token budget the context manager works against. |
| `cwd` | string | current directory | Working directory the agent operates in. Must exist. |
| `maxTurns` | positive int | `150` | Cap on iterations of the agentic loop per run. |
| `developerInstructions` | string \| null | contents of `AGENT.md` | System-level instructions. Auto-filled from an `AGENT.md` in the working directory if present. |
| `userInstructions` | string \| null | `null` | Extra instructions appended on the user's behalf. |
| `debug` | boolean | `false` | Enables debug behaviour. |

Anything you omit falls back to its default, so you only need to write the keys you want to change.

## Running

```bash
bun run dev
```

This launches the TUI (`src/tui/App.tsx`) in watch mode. Type a prompt and press <kbd>Enter</kbd> to send; <kbd>Alt</kbd>+<kbd>Enter</kbd> (or <kbd>Shift</kbd>+<kbd>Enter</kbd> in kitty-capable terminals) inserts a newline.


## How it works

A turn flows through four layers:

```
Inputbar ─► useAgent ─► Agent ─► LLMClient ─► OpenRouter
                          │
                          ├─► ContextManager   (conversation history)
                          └─► ToolRegistry     (validate + execute tools)
```

1. [`Agent.run()`](src/core/agent/agent.ts) appends the user message to the [`ContextManager`](src/core/context/manager.ts) and enters an agentic loop.
2. Each iteration sends the full message history plus the tool schemas to [`LLMClient`](src/core/client/llm_client.ts), which streams the completion back as `StreamEvent`s and reassembles fragmented tool-call deltas into complete calls.
3. Any tool calls are dispatched through the [`ToolRegistry`](src/core/tools/registry.ts), which validates arguments against the tool's Zod schema and runs it. Results go back into the context as `role: "tool"` messages.
4. The loop repeats until the model returns a turn with no tool calls.

Throughout, the agent yields `AgentEvent`s ([src/core/agent/types.ts](src/core/agent/types.ts)) — `text_delta`, `tool_call_start`, `tool_call_complete`, `agent_error`, and so on. The [`useAgent`](src/tui/hooks/useAgent.ts) hook consumes that stream and translates it into UI messages, so text renders token-by-token and tool rows flip from running to success/error in place.

Requests carry an `AbortSignal`, so an in-flight turn can be cancelled. `LLMClient` retries rate limits and 5xx responses with exponential backoff (3 attempts).

## Tools

| Tool | Kind | Description |
| --- | --- | --- |
| `read_file` | read | Reads a text file with line numbers. Supports `offset`/`limit`, rejects binaries and files over 10MB, and truncates output past 25k tokens. |

### Adding a tool

Define it with `defineTool`, which pairs a Zod schema (auto-converted to the JSON Schema the model sees) with an `execute` function:

## Debugging

The TUI owns the terminal, so `console.log` is unusable. [`debug()`](src/utils/debug.ts) writes to another terminal instead: run `tty` in a second terminal, then start the app with that device path.

```bash
DEBUG_TTY=/dev/pts/3 bun run dev
```

With `DEBUG_TTY` unset, `debug()` is a no-op.
