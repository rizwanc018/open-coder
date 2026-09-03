import { chmodSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { getDataDir } from "../config/configLoader";
import type { TokenUsage } from "../client/types";
import type { MessageItem } from "../context/types";
import { settleToolCalls, UNFINISHED_RESULT } from "../context/manager";
import { pathExists } from "../utils/path";
import type { Session } from "./session";
import { debug } from "../../shared/debug";

export interface SessionSnapshot {
    sessionId: string;
    createdAt: string;
    updatedAt: string;
    turnCount: number;
    title: string | null;
    items: MessageItem[];
    totalUsage: TokenUsage;
}

export interface CheckpointSnapshot extends SessionSnapshot {
    checkpointId: string;
}

export interface SessionSummary {
    sessionId: string;
    updatedAt: string;
    turnCount: number;
    title: string | null;
}

export interface CheckpointSummary extends SessionSummary {
    checkpointId: string;
}


function lastUserMessage(items: MessageItem[]): string | null {
    const found = items.findLast((item) => {
        const message = item.message as { role?: string; content?: unknown };
        return message.role === "user" && typeof message.content === "string" && message.content.trim() !== "";
    });

    return found ? ((found.message as { content: string }).content ?? null) : null;
}

export class PersistenceManager {
    private readonly _sessionsDir: string;
    private readonly _checkpointsDir: string;

    constructor() {
        const dataDir = getDataDir();
        this._sessionsDir = join(dataDir, "sessions");
        this._checkpointsDir = join(dataDir, "checkpoints");

        for (const dir of [this._sessionsDir, this._checkpointsDir]) {
            mkdirSync(dir, { recursive: true });
            chmodSync(dir, 0o700);
        }
    }

    private _write(path: string, snapshot: SessionSnapshot) {
        const tmp = `${path}.${process.pid}.tmp`;
        writeFileSync(tmp, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
        renameSync(tmp, path);
    }

    private _read(path: string): SessionSnapshot | null {
        if (!pathExists(path)) return null;

        try {
            return JSON.parse(readFileSync(path, "utf-8")) as SessionSnapshot;
        } catch {
            debug(`persistence: ignoring unreadable snapshot ${path}`);
            return null;
        }
    }

    saveSession(snapshot: SessionSnapshot): void {
        this._write(join(this._sessionsDir, `${snapshot.sessionId}.json`), snapshot);
    }

    saveCheckpoint(snapshot: SessionSnapshot): CheckpointSnapshot {
        const checkpoint: CheckpointSnapshot = {
            ...snapshot,
            checkpointId: randomUUID(),
            title: lastUserMessage(snapshot.items) ?? snapshot.title,
        };

        const dir = join(this._checkpointsDir, checkpoint.sessionId);
        mkdirSync(dir, { recursive: true });
        chmodSync(dir, 0o700);

        this._write(join(dir, `${checkpoint.checkpointId}.json`), checkpoint);
        return checkpoint;
    }

    loadSession(sessionId: string): SessionSnapshot | null {
        const snapshot = this._read(join(this._sessionsDir, `${sessionId}.json`));
        if (!snapshot) return null;

        return { ...snapshot, items: settleToolCalls(snapshot.items, UNFINISHED_RESULT) };
    }

    listCheckpoints(sessionId: string): CheckpointSummary[] {
        const dir = join(this._checkpointsDir, sessionId);
        if (!pathExists(dir)) return [];

        return readdirSync(dir)
            .filter((name) => name.endsWith(".json"))
            .flatMap((name) => {
                const snapshot = this._read(join(dir, name));
                return snapshot
                    ? [
                          {
                              checkpointId: name.slice(0, -".json".length),
                              sessionId,
                              updatedAt: snapshot.updatedAt,
                              turnCount: snapshot.turnCount,
                              title: snapshot.title,
                          },
                      ]
                    : [];
            })
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    listSessions(): SessionSummary[] {
        return readdirSync(this._sessionsDir)
            .filter((name) => name.endsWith(".json"))
            .flatMap((name) => {
                const snapshot = this._read(join(this._sessionsDir, name));
                return snapshot
                    ? [
                          {
                              sessionId: snapshot.sessionId,
                              updatedAt: snapshot.updatedAt,
                              turnCount: snapshot.turnCount,
                              title: snapshot.title,
                          },
                      ]
                    : [];
            })
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
}

export function snapshotOf(session: Session): SessionSnapshot {
    return {
        sessionId: session.sessionId,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        turnCount: session.turnCount,
        title: session.contextManager.title,
        items: session.contextManager.getItems(),
        totalUsage: session.contextManager.totalUsage,
    };
}
