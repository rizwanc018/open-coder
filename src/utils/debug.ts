import fs from "node:fs";

// Set DEBUG_TTY to another terminal's device path (run `tty` there to find it),
// e.g. DEBUG_TTY=/dev/pts/3. When unset, debug() is a no-op so the TUI stays clean.
const target = process.env.DEBUG_TTY;
const stream = target ? fs.createWriteStream(target) : null;

export function debug(...args: unknown[]): void {
    if (!stream) return;
    const line = args
        .map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2)))
        .join(" ");
    stream.write(line + "\n");
}
