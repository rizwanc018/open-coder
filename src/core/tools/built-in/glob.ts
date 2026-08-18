import { z } from "zod";

import { defineTool, err, ok } from "../types.ts";
import { pathExists, resolvePath } from "../../utils/path";
import { statSync } from "node:fs";
import { relative } from "node:path";
import { Glob } from "bun";
import { errorMessage } from "../../utils/error";

const MAX_RESULTS = 1000;

const schema = z.object({
    pattern: z.string().describe("Glob pattern to match, e.g. '**/*.ts'"),
    path: z.string().default(".").describe("Directory to search in (default: current directory)"),
});

export const globTool = defineTool({
    name: "glob",
    description: "Find files matching a glob pattern. Supports ** for recursive matching.",
    kind: "read",
    schema,

    async execute({ pattern, path: rawPath }, ctx) {
        const searchPath = resolvePath(ctx.cwd, rawPath);

        if (!pathExists(searchPath) || !statSync(searchPath).isDirectory()) {
            return err(`Directory does not exist: ${searchPath}`);
        }

        try {
            const glob = new Glob(pattern);
            const results: string[] = [];
            let total = 0;

            for await (const match of glob.scan({
                cwd: searchPath,
                onlyFiles: true,
                absolute: true,
            })) {
                results.push(relative(ctx.cwd, match) || match);

                if (results.length > MAX_RESULTS) {
                    break;
                }
            }

            const truncated = results.length > MAX_RESULTS;

            if (truncated) {
                results.pop();
            }

            const output = [...results];
            const metadata = {
                path: searchPath,
                pattern, 
                matches: results.length,
                truncated,
            };

            if (results.length === 0) {
                return ok(`No files matched '${pattern}'`, {
                    metadata,
                });
            }

            if (truncated) {
                output.push(`... [more than ${MAX_RESULTS} matches, results limited to ${MAX_RESULTS}]`);
            }

            return ok(output.join("\n"), {
                metadata,
            });
        } catch (error) {
            return err(`Error searching: ${errorMessage(error)}`);
        }
    },
});
