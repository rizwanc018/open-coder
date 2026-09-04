import { join, resolve } from "node:path";
import { statSync, readFileSync } from "node:fs";
import { APP_NAME, CONFIG_FILE_NAME, userConfigDir, userConfigFile, userDataDir } from "./pathLoader";
import { ConfigError, errorMessage } from "../utils/error";
import { configSchema, type Config } from "./config";

const AGENT_MD_FILE = "AGENT.md";

export const getConfigDir = () => userConfigDir(APP_NAME);
export const getDataDir = () => userDataDir(APP_NAME);
const getSystemConfigFile = () => userConfigFile();
const getProjectConfigFile = (cwd: string) => {
    const configFile = join(resolve(cwd), ".open-coder", CONFIG_FILE_NAME);
    return isFile(configFile) ? configFile : null;
};

const isFile = (path: string) => {
    try {
        return statSync(path).isFile();
    } catch {
        return false;
    }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const merge = (base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = { ...base };

    for (const [key, overrideValue] of Object.entries(override)) {
        const baseValue = result[key];
        result[key] =
            isPlainObject(baseValue) && isPlainObject(overrideValue)
                ? merge(baseValue, overrideValue)
                : overrideValue;
    }

    return result;
};

function readAgentMd(cwd: string): string | null {
    const agentMd = join(resolve(cwd), AGENT_MD_FILE);
    return isFile(agentMd) ? readFileSync(agentMd, "utf-8") : null;
}

const formatPath = (path: PropertyKey[]): string =>
    path.map((segment) => (typeof segment === "number" ? `[${segment}]` : String(segment))).join(".");

const parseJson = (filePath: string): Record<string, unknown> => {
    let text: string;
    try {
        text = readFileSync(filePath, "utf8");
    } catch (cause) {
        throw new ConfigError("Failed to read config file", { configFile: filePath, cause });
    }

    let result: unknown;
    try {
        result = JSON.parse(text);
    } catch (cause) {
        throw new ConfigError(`Invalid JSON: ${errorMessage(cause)}`, {
            configFile: filePath,
            cause,
        });
    }

    if (result === null || typeof result !== "object" || Array.isArray(result)) {
        throw new ConfigError("Config root must be a JSON object", { configFile: filePath });
    }
    return result as Record<string, unknown>;
};

export const loadConfig = (cwd?: string): Config => {
    const workingDir = cwd ?? process.cwd();
    const systemConfigFile = getSystemConfigFile();
    let configData: Record<string, unknown> = {};

    if (isFile(systemConfigFile)) {
        try {
            configData = parseJson(systemConfigFile);
        } catch (error) {
            console.warn(`Skipping invalid system config: ${errorMessage(error)}`);
        }
    }

    const projectConfigFile = getProjectConfigFile(workingDir);
    if (projectConfigFile) {
        try {
            const projectData = parseJson(projectConfigFile);
            // A project config lives inside someone's repo and will get committed.
            // Never let it be the place an API key is kept.
            if ("apiKey" in projectData) {
                delete projectData.apiKey;
                console.warn(
                    `Ignoring "apiKey" in ${projectConfigFile}: keep secrets in ${getSystemConfigFile()} ` +
                        "or the OPENROUTER_API_KEY environment variable, not in a file inside your repo.",
                );
            }
            configData = merge(configData, projectData);
        } catch (error) {
            console.warn(`Skipping invalid project config: ${errorMessage(error)}`);
        }
    }

    configData.cwd ??= workingDir;
    configData.developerInstructions ??= readAgentMd(workingDir);

    const parsedConfig = configSchema.safeParse(configData);

    if (!parsedConfig.success) {
        const issues = parsedConfig.error.issues;
        const summary = issues
            .map((issue) => `${formatPath(issue.path) || "<root>"}: ${issue.message}`)
            .join("; ");

        throw new ConfigError(`Invalid config: ${summary}`, {
            configFile: projectConfigFile ?? systemConfigFile,
            configKey: issues.length === 1 ? formatPath(issues[0]!.path) : undefined,
            cause: parsedConfig.error,
        });
    }

    return parsedConfig.data;
};
