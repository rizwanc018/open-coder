import { th } from "zod/locales";

const MAX_HISTORY = 20;
const MAX_EXACT_REPEATS = 3;
const MAX_CYCLE_LENGTH = 3;

type Action =
    | { type: "tool_call"; toolName: string; args: Record<string, unknown> }
    | { type: "response"; text: string };

export class LoopDetector {
    private _history: string[] = [];

    private _signature(action: Action): string {
        if (action.type === "response") {
            return `response|${action.text}`;
        }

        const args = Object.keys(action.args)
            .sort()
            .map((key) => `${key}=${JSON.stringify(action.args[key])}`);

        return ["tool_call", action.toolName, ...args].join("|");
    }

    record(action: Action): void {
        this._history.push(this._signature(action));

        if (this._history.length > MAX_HISTORY) this._history.shift();
    }

    check(): string | null {
        if (this._history.length >= MAX_EXACT_REPEATS) {
            const recent = this._history.slice(-MAX_EXACT_REPEATS);

            if (new Set(recent).size === 1) {
                return `The same action was repeated ${MAX_EXACT_REPEATS} times in a row`;
            }
        }

        for (let cycle = 2; cycle <= MAX_CYCLE_LENGTH; cycle++) {
            if (this._history.length < cycle * 2) break;

            const recent = this._history.slice(-cycle * 2);
            const first = recent.slice(0, cycle);
            const second = recent.slice(cycle);

            if (first.every((item, i) => item === second[i])) {
                return `Detected a repeating cycle of ${cycle} actions`;
            }
        }

        return null;
    }

    clear(): void {
        this._history = [];
    }
}
