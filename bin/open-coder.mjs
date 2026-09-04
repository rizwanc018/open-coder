#!/usr/bin/env node
// Launcher shim.
//
// This is the ONLY file in the package that must parse and run on plain Node —
// everything downstream is TS/TSX executed by Bun. `@opentui/core` renders through
// a Zig shared library it opens over FFI, and the Node FFI backend needs the
// `node:ffi` builtin, which is not shipped in released Node yet. So the package
// installs from any package manager, but it runs on Bun.
//
// Under Bun we import the entry in-process (no extra spawn). Under Node we find a
// Bun binary and hand off, and if there isn't one we say so in words instead of
// letting the user hit `env: 'bun': No such file or directory`.

import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

const ENTRY = fileURLToPath(new URL("../src/cli.tsx", import.meta.url));

const MISSING_BUN = `open-coder runs on the Bun runtime, and no \`bun\` binary was found.

Install Bun, then run open-coder again:

  curl -fsSL https://bun.sh/install | bash     (macOS / Linux / WSL)
  powershell -c "irm bun.sh/install.ps1|iex"   (Windows)
  npm install -g bun                           (any platform, via npm)

Already installed somewhere unusual? Point at it directly:

  OPEN_CODER_BUN=/path/to/bun open-coder`;

const isExecutable = (candidate) => {
    try {
        accessSync(candidate, constants.X_OK);
        return true;
    } catch {
        return false;
    }
};

const findBun = () => {
    const override = process.env.OPEN_CODER_BUN?.trim();
    if (override) return override;

    // Windows needs the extension appended; POSIX does not.
    const extensions =
        process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE").split(delimiter) : [""];

    for (const dir of (process.env.PATH ?? "").split(delimiter)) {
        if (!dir) continue;
        for (const extension of extensions) {
            const candidate = join(dir, `bun${extension}`);
            if (isExecutable(candidate)) return candidate;
        }
    }

    // Installed by bun.sh but PATH not reloaded in this shell.
    const home = join(homedir(), ".bun", "bin", process.platform === "win32" ? "bun.exe" : "bun");
    if (isExecutable(home)) return home;

    // `npm i -g bun` ships the binary inside the package.
    try {
        return createRequire(import.meta.url).resolve("bun/bin/bun");
    } catch {
        return null;
    }
};

if (process.versions.bun) {
    await import(ENTRY);
} else {
    const bun = findBun();
    if (!bun) {
        console.error(MISSING_BUN);
        process.exit(1);
    }

    // Let the child own the terminal, including signals. Registering no-op handlers
    // stops Node from killing this launcher out from under a child that is still
    // cleaning up the terminal.
    process.on("SIGINT", () => {});
    process.on("SIGTERM", () => {});

    const result = spawnSync(bun, [ENTRY, ...process.argv.slice(2)], { stdio: "inherit" });

    if (result.error) {
        console.error(`open-coder: failed to start Bun at ${bun}: ${result.error.message}`);
        process.exit(1);
    }

    process.exit(result.status ?? 1);
}
