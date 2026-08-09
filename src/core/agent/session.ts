import type { Config } from "../config/config";
import { LLMClient } from "../client/llm_client";
import { ContextManager } from "../context/manager";
import { createToolDefaultRegistry, type ToolRegistry } from "../tools/registry";
import { randomUUID } from "node:crypto";

export class Session {
    readonly _client: LLMClient | null;
    readonly _toolRegistry: ToolRegistry;
    readonly _config: Config;
    _contextManager: ContextManager;

    readonly sessionId: string;
    readonly createdAt: Date;
    updatedAt: Date;
    turnCount: number;

    constructor(config: Config) {
        this._config = config;
        this._client = new LLMClient(config);
        this._contextManager = new ContextManager(config);

        const { toolRegistry } = createToolDefaultRegistry();
        this._toolRegistry = toolRegistry;

        this.sessionId = randomUUID();
        this.createdAt = new Date();
        this.updatedAt = new Date();
        this.turnCount = 0;
    }

    incrementTurn(): number {
        this.updatedAt = new Date();
        return ++this.turnCount;
    }
}
