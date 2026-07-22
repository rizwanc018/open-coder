import { readFileTool } from "./built-in/readFile";
import type { AnyTool } from "./types";

export const getBuiltinTools = (): AnyTool[] => {
    return [readFileTool] as AnyTool[];
};
