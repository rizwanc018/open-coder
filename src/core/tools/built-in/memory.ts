import { join } from "node:path";
import { z } from "zod";

import { defineTool, err, ok } from "../types.ts";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathExists } from "../../utils/path.ts";
import { userDataDir } from "../../config/pathLoader.ts";
import { getDataDir } from "../../config/configLoader.ts";

interface MemoryStore {
    entries: Record<string, string>;
}

const RESERVED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const isValidMemoryKey = (key: string): boolean => {
    return key.trim().length > 0 && !RESERVED_KEYS.has(key);
};

const memoryPath = (): string => {
    const dir = getDataDir();
    mkdirSync(dir, { recursive: true });
    return join(dir, "memory.json");
};

export const loadMemory = (): MemoryStore => {
    const path = memoryPath();
    if (!pathExists(path)) return { entries: {} };

    try {
        const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
        const entries = (parsed as MemoryStore)?.entries;
        return entries && typeof entries === "object" ? { entries } : { entries: {} };
    } catch {
        return { entries: {} };
    }
};

function saveMemory(store: MemoryStore): void {
    writeFileSync(memoryPath(), JSON.stringify(store, null, 2), "utf-8");
}

export function memoryAsPromptSection(): string | null {
    const { entries } = loadMemory();
    const keys = Object.keys(entries);
    if (keys.length === 0) return null;

    return ["User preferences and notes:", ...keys.sort().map((key) => `- ${key}: ${entries[key]}`)].join(
        "\n",
    );
}

export const memoryTool = defineTool({
    name: "memory",
    description:
        "Store and retrieve persistent, user-specific memory across sessions. Use this to remember user preferences and personal context — not general project information.",
    kind: "memory",
    schema: z.object({
        action: z.enum(["set", "get", "delete", "list", "clear"]).describe("The operation to perform"),
        key: z.string().optional().describe("Memory key (required for set/get/delete)"),
        value: z.string().optional().describe("Value to store (required for set)"),
    }),

    async execute({ action, key, value }) {
        const store = loadMemory();

        switch (action) {
            case "set": {
                if (!key || !value) return err("`key` and `value` are required for the 'set' action");
                if (!isValidMemoryKey(key)) return err(`Invalid memory key: ${key}`);

                store.entries[key] = value;
                saveMemory(store);
                return ok(`Set memory: ${key}`, {
                    metadata: {
                        action: "set",
                        key,
                        value,
                    },
                });
            }

            case "get": {
                if (!key) return err("`key` is required for the 'get' action");
                const found = Object.hasOwn(store.entries, key);
                return ok(found ? `${key}: ${store.entries[key]}` : `Memory not found: ${key}`, {
                    metadata: {
                        action: "get",
                        key,
                        value: found ? store.entries[key] : undefined,
                        found,
                    },
                });
            }

            case "delete": {
                if (!key) return err("`key` is required for the 'delete' action");
                if (!(key in store.entries)) return ok(`Memory not found: ${key}`);

                delete store.entries[key];
                saveMemory(store);
                return ok(`Deleted memory: ${key}`, {
                    metadata: {
                        action: "delete",
                        key,
                    },
                });
            }

            case "list": {
                const keys = Object.keys(store.entries).sort();
                if (keys.length === 0) return ok("No memories stored", { metadata: { found: false } });

                const lines = ["Stored memories:", ...keys.map((k) => `  ${k}: ${store.entries[k]}`)];
                const entries = keys.map((key) => ({
                    key,
                    value: store.entries[key],
                }));

                return ok(
                    entries.length === 0
                        ? "No memories stored"
                        : [
                              "Stored memories:",
                              ...entries.map((entry) => `  ${entry.key}: ${entry.value}`),
                          ].join("\n"),
                    {
                        metadata: {
                            action: "list",
                            entries,
                        },
                    },
                );
            }

            case "clear": {
                const count = Object.keys(store.entries).length;
                saveMemory({ entries: {} });
                return ok(`Cleared ${count} memory entries`, {
                    metadata: {
                        action: "clear",
                        count,
                    },
                });
            }
        }
    },
});
