import { encode } from "gpt-tokenizer";

export function countTokens(text: string): number {
    if (!text) return 0;
    try {
        return encode(text).length;
    } catch {
        return estimateTokens(text);
    }
}

export function estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
}
