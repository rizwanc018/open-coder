import { readdirSync, statSync } from "node:fs";
import type { Config } from "../config/config";
import type { ToolRegistry } from "./registry";
import { join, resolve } from "node:path";
import { TOOL_KINDS, type AnyTool, type ToolKind } from "./types";
import { pathToFileURL } from "bun";
import { getConfigDir } from "../config/configLoader";

function isTool(value: unknown): value is AnyTool {
    if (typeof value !== "object" || value === null) return false;

    const candidate = value as Partial<AnyTool>;

    return (
        typeof candidate.name === "string" &&
        typeof candidate.description === "string" &&
        typeof candidate.kind === "string" &&
        TOOL_KINDS.includes(candidate.kind as ToolKind) &&
        typeof candidate.execute === "function" &&
        candidate.schema !== undefined
    );
}

const loadToolsFromFile = async (path: string): Promise<AnyTool[]> => {
    const module: Record<string, unknown> = await import(pathToFileURL(path).href);
    return Object.values(module)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter(isTool);
};

export class ToolDiscoveryManager {
    constructor(
        private readonly _config: Config,
        private readonly _toolRegistry: ToolRegistry,
    ) {}

    async discoverTools(toolDir: string): Promise<string[]> {
        const discovered: string[] = [];

        try {
            if (!statSync(toolDir).isDirectory()) return discovered;
        } catch (error) {
            return discovered;
        }

        for (const entry of readdirSync(toolDir)) {
            if (!/\.ts$/.test(entry)) continue;

            try {
                for (const tool of await loadToolsFromFile(join(toolDir, entry))) {
                    this._toolRegistry.register(tool);
                    discovered.push(tool.name);
                }
            } catch (error) {
                console.error(`Failed to load tool from ${toolDir}/${entry}:`, error);
            }
        }
        return discovered;
    }

    async discoverAll(): Promise<string[]> {
        return [
            ...(await this.discoverTools(join(resolve(this._config.cwd), ".open-coder", "tools"))),
            ...(await this.discoverTools(join(getConfigDir(), "tools"))),
        ];
    }
}
