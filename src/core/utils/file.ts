import { openSync, readSync, closeSync, statSync } from "node:fs";

export function isBinaryFile(path: string): boolean {
    let fd: number | undefined;
    const SAMPLE_SIZE = 8192;
    try {
        if (!statSync(path).isFile()) return false;
        fd = openSync(path, "r");
        const buffer = Buffer.alloc(SAMPLE_SIZE);
        const bytesRead = readSync(fd, buffer, 0, SAMPLE_SIZE, 0);
        return buffer.subarray(0, bytesRead).includes(0);
    } catch {
        return false;
    } finally {
        if (fd !== undefined) closeSync(fd);
    }
}


export const FILE_TYPES: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    json: "json",
    css: "css",
    html: "html",
    md: "markdown",
    sh: "bash",
    bash: "bash",
    yml: "yaml",
    yaml: "yaml",
};