import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { defineTool, ok, TOOL_KIND } from "../types";
import { createParentDirectory, resolvePath } from "../../utils/path";
import z from "zod";

const schema = z.object({
    path: z.string().describe("Path to the file to write (relative to working directory or absolute)"),
    content: z.string().describe("Content to write to the file"),
    createDirectories: z.boolean().default(true).describe("Create parent directories if they don't exist"),
});

const readIfExists = (path: string): string => {
    try {
        return existsSync(path) ? readFileSync(path, "utf-8") : "";
    } catch {
        return "";
    }
};

export const writeFileTool = defineTool({
    name: "write_file",
    description:
        "Write content to a file. Creates the file if it doesn't exist, or overwrites it if it does. " +
        "Parent directories are created automatically. Use this for creating new files or completely " +
        "replacing file contents. For partial modifications, use the edit tool instead.",
    kind: TOOL_KIND.Write,
    schema,
    confirm({ path: rawPath, content }, ctx) {
        const path = resolvePath(ctx.cwd, rawPath);
        const isNewFile = !existsSync(path);

        return {
            toolName: "write_file",
            description: `${isNewFile ? "Create" : "Overwrite"} file: ${path}`,
            params: { path: rawPath, content },
            diff: {
                path,
                oldContent: readIfExists(path),
                newContent: content,
                isNewFile,
            },
            affectedPaths: [path],
            isDangerous: !isNewFile,
        };
    },
    async execute({ path: rawPath, content, createDirectories }, ctx) {
        const path = resolvePath(ctx.cwd, rawPath);
        const isNewFile = !existsSync(path);
        let oldContent = "";

        if (!isNewFile) {
            try {
                oldContent = readFileSync(path, "utf-8");
            } catch {}
        }

        if (createDirectories) createParentDirectory(path);

        writeFileSync(path, content, "utf-8");
        const lineCount = content.split("\n").length;

        const output = `${isNewFile ? "Created" : "Updated"} ${path} (${lineCount} lines)`;
        return ok(output, {
            diff: { path, oldContent, newContent: content, isNewFile },
            metadata: {
                path,
                isNewFile,
                lines: lineCount,
                bytes: Buffer.byteLength(content, "utf-8"),
            },
        });
    },
});
