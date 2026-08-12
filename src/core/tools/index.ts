import { editFileTool } from "./built-in/editFile";
import { readFileTool } from "./built-in/readFile";
import { writeFileTool } from "./built-in/writeFile";
import type { AnyTool } from "./types";

export const getBuiltinTools = (): AnyTool[] => {
    return [readFileTool, writeFileTool, editFileTool] as AnyTool[];
};
