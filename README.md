# Open Coder

A terminal-based AI coding agent. It streams model responses into a TUI, lets the model call tools to inspect and change your codebase, and feeds the results back into the conversation until the task is done.

Built with [Bun](https://bun.sh), [OpenTUI](https://github.com/sst/opentui) (React renderer), and [OpenRouter](https://openrouter.ai) for model access.

Features: 11 built-in tools, custom tool discovery, sub-agents, an approval layer for mutating operations, automatic context compaction, persistent sessions with checkpoints and rewind, shell hooks, loop detection, and a slash-command palette.

## Requirements

- [Bun](https://bun.sh) — **required at runtime**, not just to build. Open Coder renders
  through [OpenTUI](https://github.com/sst/opentui), whose Zig core is loaded over FFI;
  the Node backend needs the `node:ffi` builtin, which released Node does not ship yet.
  You can install with any package manager, but the process that runs is Bun.
- An [OpenRouter](https://openrouter.ai/keys) API key

## Install

```bash
bun install -g @rizwanc018/open-coder     # or: npm install -g @rizwanc018/open-coder
```

Then run it in any project:

```bash
cd ~/code/my-project
open-coder
```

Installed with npm and don't have Bun? The launcher tells you how to get it. If Bun lives
somewhere unusual, point at it with `OPEN_CODER_BUN=/path/to/bun`.

No install:

```bash
bunx @rizwanc018/open-coder
```

## Configuration

Create `config.json` in your user config directory — `~/.config/open-coder/` on Linux,
`~/Library/Application Support/open-coder/` on macOS, `%LOCALAPPDATA%\open-coder\` on Windows:

```json
{
  "model": { "name": "anthropic/claude-sonnet-4.5" },
  "apiKey": "sk-or-..."
}
```

The API key resolves from `OPENROUTER_API_KEY` first, then `apiKey` in that file. A project
can override the rest in `<project>/.open-coder/config.json` — but **not** the key: that file
lives inside a repo and would get committed, so `apiKey` is ignored there with a warning.

Run `open-coder --help` for flags, or `/config` inside the TUI to see what actually resolved.

## Development

```bash
git clone https://github.com/rizwanc018/open-coder.git
cd open-coder
bun install
bun run dev
```

`bun run dev` launches the TUI ([src/cli.tsx](src/cli.tsx)) in watch mode. Bun auto-loads a
`.env` from the repo root, so an `OPENROUTER_API_KEY=sk-or-...` there works for development.

| Key | Action |
| --- | --- |
| <kbd>Enter</kbd> | Send the prompt |
| <kbd>Shift</kbd>+<kbd>Enter</kbd> / <kbd>Alt</kbd>+<kbd>Enter</kbd> | Insert a newline (needs a kitty-capable terminal for Shift) |
| <kbd>Ctrl</kbd>+<kbd>C</kbd> | Clear the input, or interrupt an in-flight turn. It does **not** quit — use `/exit` |
| <kbd>/</kbd> | Open the slash-command menu (<kbd>↑</kbd>/<kbd>↓</kbd> to move, <kbd>Tab</kbd> to complete, <kbd>Enter</kbd> to run, <kbd>Esc</kbd> to dismiss) |

The input bar grows with your text up to 5 rows, then scrolls.

## Slash commands

Defined in [src/tui/command.ts](src/tui/command.ts) and dispatched by [src/tui/commandRunner.ts](src/tui/commandRunner.ts).

| Command | Description |
| --- | --- |
| `/clear` | Clear the current conversation and start a fresh session id |
| `/config` | Show the resolved configuration |
| `/model [name]` | Show or switch the OpenRouter model for this session |
| `/approval [policy]` | Show or change the approval policy |
| `/tools` | List the tools currently exposed to the agent |
| `/todos` | Show the agent's current task list |
| `/save` | Save the current session to disk |
| `/sessions` | List saved sessions |
| `/resume [id\|number]` | Restore a saved session |
| `/checkpoint` | Snapshot the session at this point |
| `/checkpoints` | List checkpoints for the current session |
| `/rewind [id\|number]` | Restore the conversation to a checkpoint |
| `/exit` | Quit |

## Configuration

Settings come from a JSON file `config.json`, loaded by [`loadConfig()`](src/core/config/configLoader.ts) from two places:

| Scope | Location | Purpose |
| --- | --- | --- |
| System | `~/.config/open-coder/` on Linux, `~/Library/Application Support/open-coder/` on macOS, `%LOCALAPPDATA%\open-coder\` on Windows | Your defaults across every project |
| Project | `<project>/.open-coder/config.json` | Per-repo overrides |

Only one is needed. When both exist they are deep-merged, with the project file winning key by key.
An unparseable file is skipped with a warning rather than being fatal, but a file that parses and then fails validation aborts startup with the offending key (e.g. `model.temperature: Too big`).

Sessions, checkpoints and memory are written to the platform *data* directory (`~/.local/share/open-coder/` on Linux), which is separate from the config directory on Linux and the same directory on macOS/Windows. See [pathLoader.ts](src/core/config/pathLoader.ts).

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
| `allowedTools` | string[] \| null | `null` | Allowlist of tool names. `null` means every registered tool. |
| `approval` | enum | `"on-request"` | See [Approval & safety](#approval--safety). |
| `shellEnvironment.disableExcludes` | boolean | `false` | Pass the full environment to shell commands instead of filtering it. |
| `shellEnvironment.excludePatterns` | string[] | `["*KEY*","*TOKEN*","*SECRET*"]` | Env var globs stripped before running a shell command. |
| `shellEnvironment.setVars` | record | `{}` | Extra env vars injected into shell commands. |
| `hooksEnabled` | boolean | `false` | Master switch for hooks. |
| `hooks` | Hook[] | `[]` | See [Hooks](#hooks). |
| `debug` | boolean | `false` | Enables debug behaviour. |

Anything you omit falls back to its default, so you only need to write the keys you want to change.

## Tools

| Tool | Kind | Description |
| --- | --- | --- |
| `read_file` | read | Reads a text file with line numbers. Supports `offset`/`limit`, rejects binary files and files over 10 MB, truncates large output. |
| `write_file` | write | Creates or overwrites a file; parent directories are created automatically. |
| `edit_file` | write | Exact-match string replacement. `oldString` must be unique unless `replaceAll` is set. |
| `list_dir` | read | Lists a directory; directories are suffixed with `/`, hidden entries excluded by default. |
| `grep` | read | Regex search across file contents, returning path + line number + matching line. |
| `glob` | read | Finds files by glob pattern, including `**`. |
| `shell` | shell | Runs a command in the working directory with a filtered environment; returns output, exit code and termination reason. |
| `web_search` | network | Searches the web and returns titles, URLs and snippets. |
| `web_fetch` | network | Fetches a URL; HTML is converted to plain text. |
| `todos` | memory | Session task list the agent uses to track multi-step work. |
| `memory` | memory | Key/value store persisted across sessions in `memory.json`, injected into the system prompt on startup. |
| `subagent_codebase_investigator` | subagent | Read-only exploration of the codebase to answer structural questions. |
| `subagent_code_reviewer` | subagent | Read-only review pass for bugs, smells and security issues. |

Tool kinds are `read`, `write`, `shell`, `network`, `memory`, `mcp` and `subagent`. Everything except `read` counts as mutating by default, which is what drives the approval layer — a tool can override that with `isMutating()`.

### Adding a tool

Define it with `defineTool`, which pairs a Zod schema (auto-converted to the JSON Schema the model sees) with an `execute` function:

```ts
import z from "zod";
import { defineTool, ok, err, TOOL_KIND } from "../types";

export const wordCountTool = defineTool({
    name: "word_count",
    description: "Count the words in a file.",
    kind: TOOL_KIND.Read,
    schema: z.object({
        path: z.string().describe("Path to the file, relative to the working directory"),
    }),

    async execute({ path }, ctx) {
        const file = Bun.file(`${ctx.cwd}/${path}`);
        if (!(await file.exists())) return err(`No such file: ${path}`);

        const words = (await file.text()).trim().split(/\s+/).filter(Boolean);
        return ok(`${words.length} words`);
    },
});
```

Return `ok(output)` or `err(message)` — never throw for expected failures, since `err` keeps the message in the conversation as a tool result the model can react to, while a throw is caught by the registry and flattened into a generic internal error.

Optional hooks on a tool:

- `isMutating(params)` — override the kind-based default per call.
- `confirm(params, ctx)` — return a `ToolConfirmation` (description, affected paths, diff, command, `isDangerous`) so the approval dialog can show a meaningful preview instead of a raw parameter dump.

**Discovery.** [`ToolDiscoveryManager`](src/core/tools/discovery.ts) imports every `.ts` file in `<project>/.open-coder/tools/` and then `<config-dir>/tools/`, registering any export that structurally looks like a tool (including arrays of them). Dropping the file above into `.open-coder/tools/wordCount.ts` is enough — no registration step.

Note that discovered tools are `import`ed and run in-process with no sandbox, so a tools directory is as trusted as the rest of the repo.

## Sub-agents

[`createSubagentTool()`](src/core/tools/subAgent.ts) wraps a `SubagentDefinition` (goal prompt, tool allowlist, `maxTurns`, `timeoutSeconds`) as a normal tool. Calling it spins up a fresh `Agent` with its own context and a narrowed `allowedTools`, runs it to completion under a combined abort/timeout signal, and returns a summary of the termination reason, the tools it called and its final response.

The point is context isolation: an investigation that reads twenty files burns those tokens in the sub-agent's window, and the parent only pays for the summary.

Two definitions ship by default — `codebase_investigator` and `code_reviewer`, both read-only.

## Approval & safety

Every mutating tool call passes through [`ApprovalManager`](src/core/safety/approval.ts) before it executes.

| Policy | Behaviour |
| --- | --- |
| `on-request` (default) | Ask before every mutating call. |
| `auto-edit` | Auto-approve in-workspace file edits; ask for anything else. |
| `auto` | Auto-approve unless the call is flagged dangerous. |
| `never` | Reject every mutating call. |
| `yolo` | Approve everything, no checks. |

On top of the policy:

- Shell commands are matched against [`DANGEROUS_PATTERNS`](src/core/safety/commandPatterns.ts) (`rm -rf /`, `mkfs`, `dd if=`, `curl … | bash`, fork bombs, …) and rejected outright regardless of policy — `yolo` excepted.
- Read-only commands matching `SAFE_PATTERNS` (`ls`, `git status`, `npm ls`, …) are auto-approved.
- Any write whose path escapes `cwd` forces a confirmation, even under `auto`/`auto-edit`.

When confirmation is needed the TUI shows an [approval dialog](src/tui/components/ApprovalDialog.tsx) with a diff for file edits, the command for shell calls, or the raw params otherwise.

## Context & compaction

[`ContextManager`](src/core/context/manager.ts) tracks the message history and token usage. When usage passes **80%** of `model.contextWindow`, the agent pauses before the next request and runs [`ChatCompactor`](src/core/context/compaction.ts): the older prefix of the conversation is sent to the model with a summarization prompt and replaced by that summary, while a tail (up to 20 messages, capped at 15% of the threshold budget) is retained verbatim so recent detail survives.

If summarization fails, the context is left untouched rather than dropped, and the loop continues.

## Sessions & checkpoints

[`PersistenceManager`](src/core/agent/persistance.ts) writes JSON snapshots (`0600`, into `0700` directories, via write-to-temp + rename so a crash can't leave a half-written file) under the data directory:

```
<data-dir>/sessions/<sessionId>.json
<data-dir>/checkpoints/<sessionId>/<checkpointId>.json
```

A snapshot holds the message items, token totals, turn count and title. `/save` and `/checkpoint` write one; `/resume` and `/rewind` restore one into the live `Session`.

Restoring runs `settleToolCalls()`, which fills in a placeholder result for any tool call that was still pending when the snapshot was taken. This matters more than it looks: most providers reject a request whose assistant message has a `tool_call` with no matching `tool` result, so an interrupted turn would otherwise make the whole session unresumable. The same settling happens on interrupt.

## Hooks

With `hooksEnabled: true`, shell commands fire on agent lifecycle events ([HookManager](src/core/hooks/hooks.ts)):

| Trigger | Extra env |
| --- | --- |
| `before_agent` | `AI_AGENT_USER_MESSAGE` |
| `after_agent` | `AI_AGENT_USER_MESSAGE`, `AI_AGENT_RESPONSE` |
| `before_tool` | `AI_AGENT_TOOL_NAME`, `AI_AGENT_TOOL_PARAMS` |
| `after_tool` | `AI_AGENT_TOOL_NAME`, `AI_AGENT_TOOL_PARAMS`, `AI_AGENT_TOOL_RESULT` |
| `on_error` | `AI_AGENT_ERROR` |

All hooks also get `AI_AGENT_TRIGGER` and `AI_AGENT_CWD`. Hooks for a trigger run concurrently, each under its own `timeoutSec`, and a failing hook never fails the turn — it is observability, not policy.

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

## Loop detection

[`LoopDetector`](src/core/agent/loopDetector.ts) fingerprints each tool call (name + sorted args) and each assistant response over a 20-action window. Three identical actions in a row, or a repeating cycle of 2–3 actions, injects a loop-breaker prompt into the conversation telling the model to change strategy. It's a nudge, not a kill switch — `maxTurns` is the hard stop.

## How it works

A turn flows through these layers:

```
Inputbar ─► useAgent ─► Agent ─► LLMClient ─► OpenRouter
                          │
                          ├─► ContextManager   (history, usage, compaction)
                          ├─► ToolRegistry     (validate → approve → execute)
                          ├─► ApprovalManager  (safety policy + confirmations)
                          ├─► HookManager      (lifecycle shell hooks)
                          └─► LoopDetector     (repetition guard)
```

1. [`Agent.run()`](src/core/agent/agent.ts) appends the user message to the [`ContextManager`](src/core/context/manager.ts) and enters an agentic loop.
2. Each iteration compacts the context if it is over threshold, then sends the full message history plus the tool schemas to [`LLMClient`](src/core/client/llm_client.ts), which streams the completion back as `StreamEvent`s and reassembles fragmented tool-call deltas into complete calls.
3. Any tool calls are dispatched through the [`ToolRegistry`](src/core/tools/registry.ts), which checks the allowlist, validates arguments against the tool's Zod schema, runs the approval check, fires hooks and executes. Results go back into the context as `role: "tool"` messages.
4. The loop repeats until the model returns a turn with no tool calls, or `maxTurns` is hit.

Throughout, the agent yields `AgentEvent`s ([src/core/agent/types.ts](src/core/agent/types.ts)) — `text_delta`, `tool_call_start`, `tool_call_complete`, `compaction_start`, `agent_error`, and so on. The [`useAgent`](src/tui/hooks/useAgent.ts) hook consumes that stream and translates it into UI messages, so text renders token-by-token and tool rows flip from running to success/error in place. Each tool kind has its own renderer (diff, shell, grep, glob, todo, subagent, …) under [src/tui/components/](src/tui/components/).

Requests carry an `AbortSignal`, so an in-flight turn can be cancelled with <kbd>Ctrl</kbd>+<kbd>C</kbd>; pending tool calls are settled so the conversation stays valid. `LLMClient` retries rate limits and 5xx responses with exponential backoff (3 attempts).

## Debugging

The TUI owns the terminal, so `console.log` is unusable. [`debug()`](src/shared/debug.ts) writes to another terminal instead: run `tty` in a second terminal, then start the app with that device path.

```bash
DEBUG_TTY=/dev/pts/3 bun run dev
```

With `DEBUG_TTY` unset, `debug()` is a no-op. For post-hoc inspection, `writelog()` appends formatted (circular-safe) output to `logs/debug.log`.
