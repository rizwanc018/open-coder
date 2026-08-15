import { editFileTool } from "./built-in/editFile";
import { readFileTool } from "./built-in/readFile";
import { shellTool } from "./built-in/shell";
import { writeFileTool } from "./built-in/writeFile";
import type { AnyTool } from "./types";

export const getBuiltinTools = (): AnyTool[] => {
    return [readFileTool, writeFileTool, editFileTool, shellTool] as AnyTool[];
};
