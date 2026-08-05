export class AgentError extends Error {
    readonly details: Record<string, unknown>;

    constructor(message: string, options: { details?: Record<string, unknown>; cause?: unknown } = {}) {
        super(message, { cause: options.cause });
        this.name = new.target.name;
        this.details = options.details ?? {};
    }

    override toString(): string {
        let base = this.message;
        const entries = Object.entries(this.details);
        if (entries.length > 0) {
            base += ` (${entries.map(([k, v]) => `${k}=${v}`).join(", ")})`;
        }
        if (this.cause) {
            base += ` [caused by: ${this.cause}]`;
        }
        return base;
    }
}

export class ConfigError extends AgentError {
    constructor(message: string, options: { configKey?: string; configFile?: string; cause?: unknown } = {}) {
        const details: Record<string, unknown> = {};
        if (options.configKey) details.configKey = options.configKey;
        if (options.configFile) details.configFile = options.configFile;
        super(message, { details, cause: options.cause });
    }
}

export const errorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return String(error);
};
