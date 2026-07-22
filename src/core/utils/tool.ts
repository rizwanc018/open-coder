export function parseToolCallArguments(raw: string): Record<string, unknown> {
    if (!raw) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : { raw_arguments: raw };
    } catch {
        return { raw_arguments: raw };
    }
}
