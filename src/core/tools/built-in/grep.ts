import z from "zod";
import { defineTool, err, ok, TOOL_KIND } from "../types";
import { pathExists, resolvePath } from "../../utils/path";
import { errorMessage } from "../../utils/error";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { isBinaryFile } from "../../utils/file";

const IGNORED_DIRS = new Set(["node_modules", "__pycache__", ".git", ".venv", "venv", "dist", "build"]);
const MAX_FILES = 500;
const MAX_MATCHES = 1000;

const findFiles = (root: string): string[] => {
    const files: string[] = [];
    const stack = [root];

    while (stack.length > 0 && files.length < MAX_FILES) {
        const dir = stack.pop()!;

        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            if (entry.name.startsWith(".")) continue;

            const full = join(dir, entry.name);

            if (entry.isDirectory()) {
                if (!IGNORED_DIRS.has(entry.name)) stack.push(full);
            } else if (entry.isFile() && !isBinaryFile(full)) {
                files.push(full);
                if (files.length >= MAX_FILES) break;
            }
        }
    }

    return files;
};

const schema = z.object({
    pattern: z.string().describe("Regular expression pattern to search for"),
    path: z.string().default(".").describe("File or directory to search in (default: current directory)"),
    caseInsensitive: z.boolean().default(false).describe("Case-insensitive search"),
});

export const grepTool = defineTool({
    name: "grep",
    description:
        "Search for a regex pattern in file contents. Returns matching lines with file paths and line numbers.",
    kind: TOOL_KIND.Read,
    schema,

    async execute({ pattern: rawPattern, path: rawPath, caseInsensitive }, ctx) {
        const searchPath = resolvePath(ctx.cwd, rawPath);

        if (!pathExists(searchPath)) return err(`Path does not exist: ${searchPath}`);

        let pattern: RegExp;

        try {
            pattern = new RegExp(rawPattern, caseInsensitive ? "i" : "");
        } catch (error) {
            return err(`Invalid regex pattern: ${errorMessage(error)}`);
        }

        const files = statSync(searchPath).isDirectory() ? findFiles(searchPath) : [searchPath];

        const output: string[] = [];
        let matches = 0;

        for (const file of files) {
            if (matches >= MAX_MATCHES) break;

            let content: string;

            try {
                content = readFileSync(file, "utf-8");
            } catch {
                continue;
            }

            let headerAdded = false;

            for (const [i, line] of content.split("\n").entries()) {
                if (!pattern.test(line)) continue;

                matches++;

                if (!headerAdded) {
                    output.push(`> ${relative(ctx.cwd, file) || file} `);
                    headerAdded = true;
                }
                output.push(`${i + 1}:${line}`);

                if (matches >= MAX_MATCHES) {
                    output.push(`... [stopped at ${MAX_MATCHES} matches]`);
                    break;
                }
            }
            if (headerAdded) output.push("");
        }

        if (output.length === 0) {
            return ok(`No matches found for pattern '${rawPattern}'`, {
                metadata: { path: searchPath, matches: 0, filesSearched: files.length },
            });
        }
        return ok(output.join("\n"), {
            metadata: { path: searchPath, matches, filesSearched: files.length },
        });
    },
});
