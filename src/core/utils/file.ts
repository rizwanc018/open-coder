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
