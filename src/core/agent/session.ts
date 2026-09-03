import type { ApprovalPolicy, Config } from "../config/config";
import type { AnyTool } from "../tools/types";
import { LLMClient } from "../client/llm_client";
import { ContextManager } from "../context/manager";
import { createToolDefaultRegistry, type ToolRegistry } from "../tools/registry";
import { randomUUID } from "node:crypto";
import { memoryAsPromptSection } from "../tools/built-in/memory";
import { ToolDiscoveryManager } from "../tools/discovery";
import { ChatCompactor } from "../context/compaction";
import { ApprovalManager } from "../safety/approval";
import { HookManager } from "../hooks/hooks";
import { LoopDetector } from "./loopDetector";

export class Session {
    readonly _client: LLMClient | null;
    readonly _toolRegistry: ToolRegistry;
    readonly _config: Config;

    readonly approvals: ApprovalManager;
    readonly loopDetector: LoopDetector;

    sessionId: string;
    createdAt: Date;
    contextManager: ContextManager;
    compactor: ChatCompactor;
    hooks: HookManager;
    updatedAt: Date;
    turnCount: number;

    private constructor(
        config: Config,
        client: LLMClient,
        toolRegistry: ToolRegistry,
        contextManager: ContextManager,
    ) {
        this._config = config;
        this._client = client;
        this._toolRegistry = toolRegistry;
        this.contextManager = contextManager;

        this.compactor = new ChatCompactor(this._client);
        this.approvals = new ApprovalManager(this._config.approval, this._config.cwd);
        this.hooks = new HookManager(this._config);
        this.loopDetector = new LoopDetector();

        this.sessionId = randomUUID();
        this.createdAt = new Date();
        this.updatedAt = new Date();
        this.turnCount = 0;
    }

    static async create(config: Config): Promise<Session> {
        const client = new LLMClient(config);
        const { toolRegistry } = createToolDefaultRegistry(config);
        await new ToolDiscoveryManager(config, toolRegistry).discoverAll();

        const contextManager = new ContextManager(config, memoryAsPromptSection(), toolRegistry.getTools());

        return new Session(config, client, toolRegistry, contextManager);
    }

    incrementTurn(): number {
        this.updatedAt = new Date();
        return ++this.turnCount;
    }

    get model(): string {
        return this._config.model.name;
    }

    get approvalPolicy(): ApprovalPolicy {
        return this.approvals.policy;
    }

    get tools(): AnyTool[] {
        return this._toolRegistry.getTools();
    }

    setModel(name: string): void {
        this._config.model.name = name;
    }

    setApprovalPolicy(policy: ApprovalPolicy): void {
        this._config.approval = policy;
        this.approvals.policy = policy;
    }

    reset(): void {
        this.contextManager.clear();
        this.loopDetector.clear();
        this.turnCount = 0;
        this.updatedAt = new Date();
        this.createdAt = new Date();
        this.sessionId = randomUUID();
    }
}
