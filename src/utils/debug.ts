import fs from "node:fs";
import path from "node:path";

// Set DEBUG_TTY to another terminal's device path (run `tty` there to find it),
// e.g. DEBUG_TTY=/dev/pts/3. When unset, debug() is a no-op so the TUI stays clean.
const target = process.env.DEBUG_TTY;
const stream = target ? fs.createWriteStream(target) : null;

export function debug(...args: unknown[]): void {
    if (!stream) return;
    const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2))).join(" ");
    stream.write(line + "\n");
}

function format(value: unknown): string {
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.stack ?? String(value);
    const seen = new WeakSet<object>();
    try {
        return (
            JSON.stringify(
                value,
                (_key, val) => {
                    if (typeof val === "bigint") return String(val);
                    if (typeof val === "object" && val !== null) {
                        if (seen.has(val)) return "[Circular]";
                        seen.add(val);
                    }
                    return val;
                },
                2,
            ) ?? String(value)
        );
    } catch {
        return String(value);
    }
}

export function writelog(mode: "a" | "w", fileName = "logs/debug.log", ...args: unknown[]): void {
    const line = args.map(format).join(" ");

    const logPath = path.resolve(fileName);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });

    const stream = fs.createWriteStream(logPath, {
        flags: mode,
    });

    stream.write(`[${new Date().toISOString()}] ${line}\n`);
    stream.end();
}
