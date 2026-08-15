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
});

export const listDirTool = defineTool({
    name: "list_dir",
    description: "List the contents of a directory. Directories are suffixed with '/'.",
    kind: TOOL_KIND.Read,
    schema,

    async execute({ path: rawPath, includeHidden }, ctx) {
        const dir = resolvePath(ctx.cwd, rawPath);

        try {
            if (!pathExists(dir)) {
                return err(`Directory does not exist: ${dir}`);
            }

            if (!statSync(dir).isDirectory()) {
                return err(`Not a directory: ${dir}`);
            }

            
            const entries = readdirSync(dir, { withFileTypes: true })
                .filter((entry) => includeHidden || !entry.name.startsWith("."))
                .sort((a, b) => {
                    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
                    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
                });
            if (entries.length === 0) {
                return ok("Directory is empty", { metadata: { path: dir, entries: 0 } });
            }
            debug(">>> Entries : ", entries);
            const items = entries.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
            return ok(items.join("\n"), { metadata: { path: dir, entries: entries.length } });
        } catch (error) {
            return err(`Error listing directory: ${errorMessage(error)}`);
        }
    },
});
