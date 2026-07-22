import { encode } from "gpt-tokenizer";

export const countTokens = (text: string): number => {
    if (!text) return 0;
    try {
        return encode(text).length;
    } catch {
        return estimateTokens(text);
    }
};

export const estimateTokens = (text: string): number => {
    return Math.max(1, Math.ceil(text.length / 4));
};

export const truncateText = (text: string, maxTokens: number, suffix = "\n... [truncated]"): string => {
    if (countTokens(text) <= maxTokens) return text;

    const targetTokens = maxTokens - countTokens(suffix);
    if (targetTokens <= 0) return suffix.trim();

    const lines = text.split("\n");
    const kept: string[] = [];
    let used = 0;

    for (const line of lines) {
        const lineTokens = countTokens(line + "\n");
        if (used + lineTokens > targetTokens) break;
        kept.push(line);
        used += lineTokens;
    }

    if (kept.length > 0) return kept.join("\n") + suffix;

    let low = 0;
    let high = text.length;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (countTokens(text.slice(0, mid)) <= targetTokens) low = mid;
        else high = mid - 1;
    }
    return text.slice(0, low) + suffix;
};
