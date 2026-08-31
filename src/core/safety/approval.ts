import type { ApprovalPolicy } from "../config/config";
import type { ToolConfirmation } from "../tools/types";
import { isWithin } from "../utils/path";
import { DANGEROUS_PATTERNS, SAFE_PATTERNS } from "./commandPatterns";

export type ConfirmationCallback = (confirmation: ToolConfirmation) => Promise<boolean>;

export type ApprovalDecision = "approved" | "rejected" | "needs_confirmation";

export interface ApprovalContext {
    toolName: string;
    params: Record<string, unknown>;
    isMutating: boolean;
    affectedPaths: string[];
    command?: string;
    isDangerous: boolean;
}

export const isDangerousCommand = (command: string): boolean => {
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
};

export const isSafeCommand = (command: string): boolean => {
    return SAFE_PATTERNS.some((pattern) => pattern.test(command.trim()));
};

export class ApprovalManager {
    confirmationCallback: ConfirmationCallback | null = null;
    policy: ApprovalPolicy;
    private readonly _cwd: string;

    constructor(policy: ApprovalPolicy, cwd: string) {
        this.policy = policy;
        this._cwd = cwd;
    }

    private assessCommnad(command: string): ApprovalDecision {
        if (isDangerousCommand(command)) return "rejected";

        if (isSafeCommand(command)) return "approved";

        if (this.policy === "never") return "rejected";
        if (this.policy === "auto") return "approved";

        return "needs_confirmation";
    }

    async checkApproval(context: ApprovalContext): Promise<ApprovalDecision> {
        if (this.policy === "yolo") return "approved";

        if (!context.isMutating) return "approved";

        if (context.command) {
            const decision = this.assessCommnad(context.command);
            if (decision !== "needs_confirmation") return decision;
        }

        const escapesWorkspace = context.affectedPaths.some((path) => !isWithin(this._cwd, path));

        if (escapesWorkspace) {
            return this.policy === "never" ? "rejected" : "needs_confirmation";
        }

        switch (this.policy) {
            case "never":
                return "rejected";

            case "auto":
                return context.isDangerous ? "needs_confirmation" : "approved";

            case "auto-edit":
                return context.affectedPaths.length > 0 && !context.isDangerous
                    ? "approved"
                    : "needs_confirmation";

            case "on-request":
            default:
                return "needs_confirmation";
        }
    }

    async requestConfirmation(confirmation: ToolConfirmation): Promise<boolean> {
        if (!this.confirmationCallback) return false;
        return this.confirmationCallback(confirmation);
    }
}
