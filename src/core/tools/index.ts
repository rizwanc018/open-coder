import { editFileTool } from "./built-in/editFile";
import { globTool } from "./built-in/glob";
import { grepTool } from "./built-in/grep";
import { listDirTool } from "./built-in/listDir";
import { readFileTool } from "./built-in/readFile";
import { shellTool } from "./built-in/shell";
import { webSearchTool } from "./built-in/WebSearch";
import { writeFileTool } from "./built-in/writeFile";
import type { AnyTool } from "./types";

export const getBuiltinTools = (): AnyTool[] => {
    return [
        readFileTool,
        writeFileTool,
        editFileTool,
        shellTool,
        listDirTool,
        grepTool,
        globTool,
        webSearchTool,
    ] as AnyTool[];
};
