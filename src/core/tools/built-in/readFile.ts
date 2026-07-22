import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { z } from "zod";

import { defineTool, err, ok } from "../types.ts";
import { countTokens, truncateText } from "../../utils/text.ts";
import { pathExists, resolvePath } from "../../utils/path.ts";
import { isBinaryFile } from "../../utils/file.ts";
import { errorMessage } from "../../utils/error.ts";

const MB = 1024 * 1024;
const MAX_FILE_SIZE = 10 * MB;
const MAX_OUTPUT_TOKENS = 25_000;

export const readFileTool = defineTool({
    name: "read_file",
    description:
        "Read the contents of a text file. Returns the file content with line numbers. " +
        "For large files, use offset and limit to read specific portions. " +
        "Cannot read binary files (images, executables, etc.).",
    kind: "read",
    schema: z.object({
        path: z.string().describe("Path to the file to read (relative to working directory or absolute)"),
        offset: z
            .number()
            .int()
            .min(1)
            .default(1)
            .describe("Line number to start reading from (1-based). Defaults to 1"),
        limit: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe("Maximum number of lines to read. If omitted, reads the entire file."),
    }),

    async execute({ path: rawPath, offset, limit }, ctx) {
        const path = resolvePath(ctx.cwd, rawPath);

        if (!pathExists(path)) return err(`File not found: ${path}`);

        const stat = statSync(path);
        if (!stat.isFile()) return err(`Path is not a file: ${path}`);

        if (stat.size > MAX_FILE_SIZE) {
            return err(
                `File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). ` +
                    `Maximum is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
            );
        }

        if (isBinaryFile(path)) {
            const sizeStr =
                stat.size >= 1024 * 1024 ? `${(stat.size / 1024 / 1024).toFixed(2)}MB` : `${stat.size} bytes`;
            return err(
                `Cannot read binary file: ${basename(path)} (${sizeStr}). This tool only reads text files.`,
            );
        }

        try {
            const content = readFileSync(path, "utf-8");
            const lines = content.split("\n");

            // A trailing newline produces a final empty element that isn't a real line.
            if (lines.at(-1) === "") lines.pop();

            const totalLines = lines.length;
            if (totalLines === 0) return ok("File is empty.", { metadata: { lines: 0 } });

            const startIdx = Math.max(0, offset - 1);
            const endIdx = limit !== undefined ? Math.min(startIdx + limit, totalLines) : totalLines;

            const selected = lines.slice(startIdx, endIdx);
            let output = selected
                .map((line, i) => `${String(startIdx + i + 1).padStart(6)}|${line}`)
                .join("\n");

            let truncated = false;
            if (countTokens(output) > MAX_OUTPUT_TOKENS) {
                output = truncateText(
                    output,
                    MAX_OUTPUT_TOKENS,
                    `\n... [truncated, ${totalLines} total lines]`,
                );
                truncated = true;
            }

            if (startIdx > 0 || endIdx < totalLines) {
                output = `Showing lines ${startIdx + 1}-${endIdx} of ${totalLines}\n\n${output}`;
            }

            return ok(output, {
                truncated,
                metadata: {
                    path,
                    totalLines,
                    shownStart: startIdx + 1,
                    shownEnd: endIdx,
                },
            });
        } catch (error) {
            return err(`Failed to read file: ${errorMessage(error)}`);
        }
    },
});
