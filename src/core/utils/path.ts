import { dirname, isAbsolute, resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

export const resolvePath = (base: string, path: string): string => {
    return isAbsolute(path) ? resolve(path) : resolve(base, path);
};

export const pathExists = (path: string): boolean => {
    return existsSync(path);
};

export const createParentDirectory = (path: string): string => {
    mkdirSync(dirname(path), { recursive: true });
    return path;
};
