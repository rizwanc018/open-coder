import z from "zod";
import { defineTool, err, ok, TOOL_KIND } from "../types";
import { pathExists, resolvePath } from "../../utils/path";
import { readdirSync, statSync } from "node:fs";
import { errorMessage } from "../../utils/error";
import { debug } from "../../../shared/debug";

const schema = z.object({
    path: z.string().default(".").describe("Directory path to list (default: current directory)"),
    includeHidden: z
        .boolean()
        .default(false)
        .describe("Include hidden files and directories (default: false)"),
    limit: z
        .number()
        .int()
        .min(1)
        .max(3)
        .default(2)
        .describe("Maximum number of entries to return (default: 2, max: 3)"),
    offset: z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe("Number of entries to skip before returning results (default: 0)"),
});

export const listDirTool = defineTool({
    name: "list_dir",
    description:
        "List files and directories in a directory. Directories are suffixed with '/'. Hidden entries are excluded by default.",
    kind: TOOL_KIND.Read,
    schema,

    async execute({ path: rawPath, includeHidden, limit, offset }, ctx) {
        const dir = resolvePath(ctx.cwd, rawPath);

        try {
            const stat = statSync(dir);

            if (!stat.isDirectory()) {
                return err(`Not a directory: ${dir}`);
            }

            const entries = readdirSync(dir, { withFileTypes: true })
                .filter((entry) => includeHidden || !entry.name.startsWith("."))
                .sort((a, b) => {
                    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
                    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
                });

            const totalEntries = entries.length;
            const visibleEntries = entries.slice(offset, offset + limit);
            const returnedCount = visibleEntries.length;
            const hasMore = offset + returnedCount < totalEntries;
            const entriesWithFiletype = visibleEntries.map((entry) => ({
                name: entry.name,
                type: entry.isDirectory() ? "directory" : "file",
            }));

            let metadata = {
                path: dir,
                totalEntries,
                offset,
                limit,
                returnedCount,
                hasMore,
                entries: entriesWithFiletype,
            };

            if (totalEntries === 0) {
                return ok("Directory is empty", { metadata });
            }

            if (returnedCount === 0) {
                return ok("No entries found at this offset", { metadata });
            }
            const items = visibleEntries.map((entry) =>
                entry.isDirectory() ? `${entry.name}/` : entry.name,
            );
            const output = hasMore ? `${items.join("\n")}\n\n... more entries available` : items.join("\n");
            return ok(output, { metadata });
        } catch (error) {
            return err(`Error listing directory: ${errorMessage(error)}`);
        }
    },
});
