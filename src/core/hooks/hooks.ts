import { debug } from "node:console";
import type { Config, HookConfig, HookTrigger } from "../config/config";
import { toModelOutput, type ToolResult } from "../tools/types";
import { errorMessage } from "../utils/error";

type HookEnv = Record<string, string>;

export class HookManager {
    private _config: Config;
    private readonly _hooks: HookConfig[];

    constructor(config: Config) {
        this._config = config;
        this._hooks = config.hooksEnabled ? config.hooks.filter((hook) => hook.enabled) : [];
    }

    private _buildEnv(trigger: HookTrigger, extra: HookEnv = {}): HookEnv {
        return {
            ...(process.env as HookEnv),
            AI_AGENT_TRIGGER: trigger,
            AI_AGENT_CWD: this._config.cwd,
            ...extra,
        };
    }

    private async _runHook(hook: HookConfig, env: HookEnv): Promise<void> {
        const command = hook.command ?? hook.script;
        if (!command) return;

        try {
            const proc = Bun.spawn(["/bin/bash", "-c", command], {
                cwd: this._config.cwd,
                env,
                stdout: "ignore",
                stderr: "pipe",
                signal: AbortSignal.timeout(hook.timeoutSec * 1000),
            });

            await proc.exited;
        } catch (error) {
            if (this._config.debug) {
                console.error(`Hook '${hook.name}' failed: ${errorMessage(error)}`);
            }
        }
    }

    private async _fire(trigger: HookTrigger, env: HookEnv) {
        const matching = this._hooks.filter((hook) => hook.trigger === trigger);
        if (matching.length === 0) return;

        const builtEnv = this._buildEnv(trigger, env);
        await Promise.allSettled(matching.map((hook) => this._runHook(hook, builtEnv)));
    }

    async triggerBeforeAgent(message: string) {
        await this._fire("before_agent", { AI_AGENT_USER_MESSAGE: message });
    }

    async triggerAfterAgent(userMessage: string, response: string | null): Promise<void> {
        await this._fire("after_agent", {
            AI_AGENT_USER_MESSAGE: userMessage,
            AI_AGENT_RESPONSE: response ?? "",
        });
    }

    async triggerBeforeTool(toolName: string, params: Record<string, unknown>): Promise<void> {
        await this._fire("before_tool", {
            AI_AGENT_TOOL_NAME: toolName,
            AI_AGENT_TOOL_PARAMS: JSON.stringify(params),
        });
    }

    async triggerAfterTool(
        toolName: string,
        params: Record<string, unknown>,
        result: ToolResult,
    ): Promise<void> {
        await this._fire("after_tool", {
            AI_AGENT_TOOL_NAME: toolName,
            AI_AGENT_TOOL_PARAMS: JSON.stringify(params),
            AI_AGENT_TOOL_RESULT: toModelOutput(result),
        });
    }

    async triggerOnError(error: unknown): Promise<void> {
        await this._fire("on_error", { AI_AGENT_ERROR: errorMessage(error) });
    }
}
