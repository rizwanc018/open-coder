import { getSystemPrompt } from "../prompts/system";
import { countTokens } from "../utils/text";
import type { MessageItem } from "./types";
import type { ToolCall } from "../agent/types";
import type { ChatMessages, ChatToolCall } from "@openrouter/sdk/models";
import type { Config } from "../config/config";
import type { AnyTool } from "../tools/types";
import { addUsage, EMPTY_USAGE, type TokenUsage } from "../client/types";

const PRUNE_PROTECT_TOKENS = 40_000;
/** Don't bother pruning unless we'd reclaim at least this much. */
const PRUNE_MINIMUM_TOKENS = 20_000;
const COMPRESSION_THRESHOLD = 0.8;

export class ContextManager {
    private readonly _config: Config;
    private readonly _systemPrompt: string;
    private _messages: MessageItem[] = [];
    private latestUsage: TokenUsage = EMPTY_USAGE;
    totalUsage: TokenUsage = EMPTY_USAGE;

    constructor(config: Config, userMemory: string | null, tools: AnyTool[]) {
        this._config = config;
        this._systemPrompt = getSystemPrompt(config, userMemory, tools);
    }

    addUserMessage(content: string): void {
        this._messages.push({
            message: { role: "user", content },
            tokenCount: countTokens(content),
        });
    }

    addAssistantMessage(content: string | null, toolCalls: ToolCall[] = []): void {
        const text = content ?? "";
        const sdkToolCalls: ChatToolCall[] = toolCalls.map((call) => ({
            id: call.callId,
            type: "function",
            function: {
                name: call.name,
                arguments: JSON.stringify(call.arguments),
            },
        }));

        this._messages.push({
            message: {
                role: "assistant",
                content: text,
                ...(sdkToolCalls.length > 0 ? { toolCalls: sdkToolCalls } : {}),
            },
            tokenCount: countTokens(text + sdkToolCalls.map((tc) => tc.function.arguments).join("")),
        });
    }

    addToolResult(callId: string, content: string): void {
        this._messages.push({
            message: { role: "tool", content, toolCallId: callId },
            tokenCount: countTokens(content),
        });
    }


    recordUsage(usage: TokenUsage): void {
        this.latestUsage = usage;
        this.totalUsage = addUsage(this.totalUsage, usage);
    }

    /**
     * A side-channel completion (compaction, titling, …): bills the cost only. Its
     * prompt is not the live conversation, so it must never move the context gauge.
     */
    recordCost(usage: TokenUsage): void {
        this.totalUsage = addUsage(this.totalUsage, usage);
    }

    getTokenCount(): number {
        return this._messages.reduce(
            (total, item) => total + item.tokenCount,
            countTokens(this._systemPrompt),
        );
    }

    get contextTokens(): number {
        return this.latestUsage.totalTokens;
    }

    get contextUsageRatio(): number {
        return this.latestUsage.totalTokens / this._config.model.contextWindow;
    }

    needsCompression(): boolean {
        return this.contextUsageRatio > COMPRESSION_THRESHOLD;
    }

    isOverContextWindow(): boolean {
        return this.getTokenCount() >= this._config.model.contextWindow;
    }

    getMessages(): ChatMessages[] {
        const messages: ChatMessages[] = [];
        if (this._systemPrompt) {
            messages.push({ role: "system", content: this._systemPrompt });
        }
        for (const { message } of this._messages) {
            messages.push(message);
        }
        return messages;
    }

    replaceWithSummary(summary: string): void {
        const continuation = `# Context Restoration (Previous Session Compacted)

The previous conversation was compacted because it hit the context limit. Below is a summary of the work so far.

**CRITICAL: Actions listed under "COMPLETED ACTIONS" are already done. DO NOT repeat them.**

---

${summary}

---

Resume from where we left off. Focus ONLY on the remaining tasks.`;

        const acknowledgement = `I've reviewed the context from the previous session. I understand:
- The original goal and what was requested
- Which actions are ALREADY COMPLETED (I will NOT repeat these)
- The current state of the project
- What still needs to be done

I'll continue with the REMAINING tasks only, starting from where we left off.`;

        const resume =
            "Continue with the REMAINING work only. Do NOT repeat any completed actions. Proceed with the next step described above.";

        this._messages = [
            { message: { role: "user", content: continuation }, tokenCount: countTokens(continuation) },
            {
                message: { role: "assistant", content: acknowledgement },
                tokenCount: countTokens(acknowledgement),
            },
            { message: { role: "user", content: resume }, tokenCount: countTokens(resume) },
        ];

        // The provider-reported gauge now describes a history that no longer exists.
        // Fall back to the local estimate; the next real completion corrects it.
        this.latestUsage = { ...EMPTY_USAGE, totalTokens: this.getTokenCount() };
    }
}
