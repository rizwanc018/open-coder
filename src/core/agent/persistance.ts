import { chmodSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
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

export interface SessionSummary {
    sessionId: string;
    updatedAt: string;
    turnCount: number;
    title: string | null;
}


function isSnapshot(value: unknown): value is SessionSnapshot {
    if (typeof value !== "object" || value === null) return false;
    const snapshot = value as Partial<SessionSnapshot>;

    return (
        typeof snapshot.sessionId === "string" &&
        typeof snapshot.createdAt === "string" &&
        typeof snapshot.updatedAt === "string" &&
        typeof snapshot.turnCount === "number" &&
        (snapshot.title === null || typeof snapshot.title === "string") &&
        Array.isArray(snapshot.items) &&
        snapshot.items.every(
            (item) =>
                typeof item === "object" &&
                item !== null &&
                typeof item.tokenCount === "number" &&
                typeof item.message === "object" &&
                item.message !== null,
        ) &&
        typeof snapshot.totalUsage === "object" &&
        snapshot.totalUsage !== null
    );
}

export class PersistenceManager {
    private readonly _sessionsDir: string;

    constructor() {
        const dataDir = getDataDir();
        this._sessionsDir = join(dataDir, "sessions");

        mkdirSync(this._sessionsDir, { recursive: true });
        chmodSync(this._sessionsDir, 0o700);
    }

    private _write(path: string, snapshot: SessionSnapshot) {
        const tmp = `${path}.${process.pid}.tmp`;
        writeFileSync(tmp, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
        renameSync(tmp, path);
    }

    private _read(path: string): SessionSnapshot | null {
        if (!pathExists(path)) return null;

        try {
            const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
            if (!isSnapshot(parsed)) {
                debug(`persistence: ignoring unreadable snapshot ${path}`);
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    }

    saveSession(snapshot: SessionSnapshot): void {
        this._write(join(this._sessionsDir, `${snapshot.sessionId}.json`), snapshot);
    }

    loadSession(sessionId: string): SessionSnapshot | null {
        const snapshot = this._read(join(this._sessionsDir, `${sessionId}.json`));
        if (!snapshot) return null;

        return { ...snapshot, items: settleToolCalls(snapshot.items, UNFINISHED_RESULT) };
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
