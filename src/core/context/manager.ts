import { getSystemPrompt } from "../prompts/system";
import { countTokens } from "../utils/text";
import type { MessageItem } from "./types";
import type { ToolCall } from "../agent/types";
import type { ChatMessages, ChatToolCall } from "@openrouter/sdk/models";
import type { Config } from "../config/config";
import type { AnyTool } from "../tools/types";
import { addUsage, EMPTY_USAGE, type TokenUsage } from "../client/types";

const COMPRESSION_THRESHOLD = 0.8;
const TAIL_BUDGET_RATIO = 0.15;
const TAIL_MAX_MESSAGES = 20;

export interface CompactionPlan {
    prefix: ChatMessages[];
    tailStart: number;
    tailTokens: number;
}

export class ContextManager {
    private readonly _config: Config;
    private readonly _systemPrompt: string;
    private readonly _systemPromptTokens: number;
    private _messages: MessageItem[] = [];
    private latestUsage: TokenUsage = EMPTY_USAGE;
    totalUsage: TokenUsage = EMPTY_USAGE;

    constructor(config: Config, userMemory: string | null, tools: AnyTool[]) {
        this._config = config;
        this._systemPrompt = getSystemPrompt(config, userMemory, tools);
        this._systemPromptTokens = countTokens(this._systemPrompt);
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

    /** Tokens held by the conversation alone. Use this to measure a delta. */
    private _messageTokens(): number {
        return this._messages.reduce((total, item) => total + item.tokenCount, 0);
    }

    /** Tokens the next request will occupy in the window. Use this to measure against a budget. */
    getTokenCount(): number {
        return this._systemPromptTokens + this._messageTokens();
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

    planCompaction(): CompactionPlan | null {
        const tailStart = this._tailStart();
        if (tailStart === 0) return null;

        const prefix = this._messages.slice(0, tailStart).map((item) => item.message);
        const tailTokens = this._messages
            .slice(tailStart)
            .reduce((total, item) => total + item.tokenCount, 0);

        return { prefix, tailStart, tailTokens };
    }

    private _tailStart(): number {
        const budget = Math.floor(
            this._config.model.contextWindow * COMPRESSION_THRESHOLD * TAIL_BUDGET_RATIO,
        );

        let tokens = 0;
        let start = this._messages.length;

        for (let i = this._messages.length - 1; i >= 0; i--) {
            const item = this._messages[i]!;
            if (this._messages.length - i > TAIL_MAX_MESSAGES) break;
            if (tokens + item.tokenCount > budget) break;
            tokens += item.tokenCount;
            start = i;
        }
        while (start < this._messages.length && this._messages[start]!.message.role === "tool") {
            start++;
        }

        return start;
    }

    replaceWithSummary(summary: string, plan: CompactionPlan): void {
        const tokensBefore = this._messageTokens();
        const tail = this._messages.slice(plan.tailStart);

        const continuation = `# Context Restoration (Previous Session Compacted)

The earlier part of this conversation was compacted because it hit the context limit. Below is a summary of that work.

**CRITICAL: Actions listed under "COMPLETED ACTIONS" are already done. DO NOT repeat them.**

---

${summary}

---

${
    tail.length > 0
        ? "The messages that follow are the verbatim, uncompacted tail of the conversation — they are NOT covered by the summary above. Resume from the end of that tail and focus ONLY on the remaining tasks."
        : "Resume from where we left off. Focus ONLY on the remaining tasks."
}`;

        const acknowledgement = `I've reviewed the context from the previous session. I understand:
- The original goal and what was requested
- Which actions are ALREADY COMPLETED (I will NOT repeat these)
- The current state of the project
- What still needs to be done

I'll continue with the REMAINING tasks only, starting from where we left off.`;

        const head: MessageItem[] = [
            { message: { role: "user", content: continuation }, tokenCount: countTokens(continuation) },
        ];

        if (tail[0]?.message.role !== "assistant") {
            head.push({
                message: { role: "assistant", content: acknowledgement },
                tokenCount: countTokens(acknowledgement),
            });
        }
        if (tail.length === 0) {
            const resume =
                "Continue with the REMAINING work only. Do NOT repeat any completed actions. Proceed with the next step described above.";
            head.push({ message: { role: "user", content: resume }, tokenCount: countTokens(resume) });
        }

        this._messages = [...head, ...tail];

        if (tail.length > 0 && this._messageTokens() >= tokensBefore) {
            this._messages = head;
        }

        this.latestUsage = { ...EMPTY_USAGE, totalTokens: this.getTokenCount() };
    }
}
