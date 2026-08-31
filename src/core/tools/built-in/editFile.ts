import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { defineTool, err, ok, TOOL_KIND, type ToolResult } from "../types";
import { createParentDirectory, resolvePath } from "../../utils/path";
import { errorMessage } from "../../utils/error";

const schema = z.object({
    path: z.string().describe("Path to the file to edit (relative to working directory or absolute)"),
    oldString: z
        .string()
        .default("")
        .describe(
            "The exact text to find and replace. Must match exactly, including all whitespace and " +
                "indentation. Leave empty to create a new file.",
        ),
    newString: z.string().describe("The text to replace oldString with. Can be empty to delete text."),
    replaceAll: z.boolean().default(false).describe("Replace all occurrences of oldString (default: false)"),
});

const countOccurrences = (content: string, search: string): number => {
    if (!search) return 0;

    let count = 0;
    let index = content.indexOf(search);
    while (index !== -1) {
        count++;
        index = content.indexOf(search, index + search.length);
    }
    return count;
};

const noMatchError = (content: string, oldString: string, path: string): ToolResult => {
    const lines = content.split("\n");
    const searchTerm = oldString
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)[0];

    const similarLines: string[] = [];

    if (searchTerm) {
        for (const [index, line] of lines.entries()) {
            if (line.includes(searchTerm)) {
                similarLines.push(`  Line ${index + 1}: ${line.trim().slice(0, 120)}`);

                if (similarLines.length >= 3) break;
            }
        }
    }

    let message = `oldString not found in ${path}.`;

    if (similarLines.length > 0) {
        message +=
            `\n\nPossible similar lines:\n${similarLines.join("\n")}` +
            "\n\nMake sure oldString matches exactly, including whitespace and indentation.";
    } else {
        message +=
            " Make sure the text matches exactly, including:\n" +
            "- All whitespace and indentation\n" +
            "- Line breaks\n" +
            "- Any invisible characters\n" +
            "Try re-reading the file with read_file, then editing.";
    }

    return err(message);
};

const replaceLiteral = (content: string, oldStr: string, newStr: string, all: boolean): string => {
    return all ? content.split(oldStr).join(newStr) : content.replace(oldStr, () => newStr);
};

export const editFileTool = defineTool({
    name: "edit_file",
    description:
        "Edit a file by replacing text. The oldString must match exactly (including whitespace and " +
        "indentation) and must be unique in the file unless replaceAll is true. Use this for precise, " +
        "surgical edits. For creating new files or complete rewrites, use write_file instead.",
    kind: TOOL_KIND.Write,
    schema,

    confirm({ path: rawPath, oldString, newString, replaceAll }, ctx) {
        const path = resolvePath(ctx.cwd, rawPath);

        if (!existsSync(path)) {
            return {
                toolName: "edit_file",
                description: `Create new file: ${path}`,
                params: { path: rawPath, oldString, newString, replaceAll },
                diff: { path, oldContent: "", newContent: newString, isNewFile: true },
                affectedPaths: [path],
            };
        }

        const oldContent = readFileSync(path, "utf-8");

        return {
            toolName: "edit_file",
            description: `Edit file: ${path}`,
            params: { path: rawPath, oldString, newString, replaceAll },
            diff: {
                path,
                oldContent,
                newContent: replaceLiteral(oldContent, oldString, newString, replaceAll),
            },
            affectedPaths: [path],
        };
    },

    async execute({ path: rawPath, oldString, newString, replaceAll }, ctx) {
        const path = resolvePath(ctx.cwd, rawPath);

        if (!existsSync(path)) {
            if (oldString) {
                return err(`File does not exist: ${path}. To create a new file, pass an empty oldString.`);
            }
            try {
                createParentDirectory(path);
                writeFileSync(path, newString, "utf-8");
            } catch (error) {
                return err(`Failed to create file: ${errorMessage(error)}`);
            }
            const lineCount = newString.split("\n").length;

            return ok(`Created ${path} (${lineCount} lines)`, {
                diff: { path, oldContent: "", newContent: newString, isNewFile: true },
                metadata: { path, isNewFile: true, lines: lineCount },
            });
        }

        if (!oldString) {
            return err(
                "oldString is empty but the file exists. Provide oldString to edit, or use write_file to overwrite.",
            );
        }

        if (oldString === newString) {
            return err("oldString and newString are identical. The edit would not change anything.");
        }

        let oldContent: string;
        try {
            oldContent = readFileSync(path, "utf-8");
        } catch (error) {
            return err(`Failed to read file: ${errorMessage(error)}`);
        }
        const occurrences = countOccurrences(oldContent, oldString);

        if (occurrences === 0) return noMatchError(oldContent, oldString, path);

        if (occurrences > 1 && !replaceAll) {
            return err(
                `oldString found ${occurrences} times in ${path}. Either:\n` +
                    "1. Provide more surrounding context to make the match unique, or\n" +
                    "2. Set replaceAll=true to replace every occurrence.",
                { metadata: { occurrences } },
            );
        }

        const newContent = replaceAll
            ? oldContent.split(oldString).join(newString)
            : oldContent.replace(oldString, () => newString);

        try {
            writeFileSync(path, newContent, "utf-8");
        } catch (error) {
            return err(`Failed to write file: ${errorMessage(error)}`);
        }

        const replaced = replaceAll ? occurrences : 1;
        const output = `Updated ${path} (${replaced} ${replaced === 1 ? "replacement" : "replacements"})`;

        return ok(output, {
            diff: { path, oldContent, newContent, isNewFile: false },
            metadata: {
                path,
                isNewFile: false,
                occurrences,
                replaced,
                lines: newContent.split("\n").length,
            },
        });
    },
});
