import { editFileTool } from "./built-in/editFile";
import { globTool } from "./built-in/glob";
import { grepTool } from "./built-in/grep";
import { listDirTool } from "./built-in/listDir";
import { readFileTool } from "./built-in/readFile";
import { shellTool } from "./built-in/shell";
import { todostool } from "./built-in/todo";
import { webFetchTool } from "./built-in/webFetch";
import { webSearchTool } from "./built-in/webSearch";
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
        webFetchTool,
        todostool,
    ] as AnyTool[];
};
