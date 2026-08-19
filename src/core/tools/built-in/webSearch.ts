import z from "zod";
import { defineTool, err, ok, TOOL_KIND } from "../types";
import { errorMessage } from "../../utils/error";
import { htmlToText } from "../../utils/web";

interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

const RESULT_BLOCK = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
const SNIPPET_BLOCK = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

const parseHtml = (html: string, limit: number): SearchResult[] => {
    const links = [...html.matchAll(RESULT_BLOCK)];
    const snippets = [...html.matchAll(SNIPPET_BLOCK)];

    const results: SearchResult[] = [];

    for (const [i, item] of links.entries()) {
        if (results.length > limit) break;

        const href = item[1];
        const title = htmlToText(item[2] || "");
        if (!href || !title) continue;

        let url = href;
        const wrapped = new URL(href, "https://duckduckgo.com").searchParams.get("uddg");
        if (wrapped) url = wrapped;

        results.push({
            title,
            url,
            snippet: htmlToText(snippets[i]?.[1] ?? ""),
        });
    }

    return results;
};

const schema = z.object({
    query: z.string().describe("Search query"),
    maxResults: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(10)
        .describe("Maximum results to return (default: 10)"),
});

export const webSearchTool = defineTool({
    name: "web_search",
    description:
        "Search the web. Returns results with titles, URLs, and snippets. Follow up with web_fetch " +
        "to read a specific result.",
    kind: TOOL_KIND.Network,
    schema,

    async execute({ query, maxResults }, ctx) {
        const timeoutSignal = AbortSignal.timeout(30_000);
        const signal = ctx.signal ? AbortSignal.any([ctx.signal, timeoutSignal]) : timeoutSignal;

        let html: string;

        try {
            const response = await fetch("https://html.duckduckgo.com/html/", {
                method: "POST",
                signal,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent":
                        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
                },
                body: new URLSearchParams({ q: query }),
            });

            if (!response.ok) return err(`Search failed: HTTP ${response.status}`);

            html = await response.text();
        } catch (error) {
            return err(`Search failed: ${errorMessage(error)}`);
        }
        const results = parseHtml(html, maxResults);
        if (results.length === 0) {
            return ok(`No results found for: ${query}`, { metadata: { query, resultCount: 0 } });
        }

        const output = [`Search results for : ${query}`, ""];

        for (const [i, result] of results.entries()) {
            output.push(`[${i + 1}] ${result.title}`);
            output.push(`URL: ${result.url}`);
            if (result.snippet) output.push(`Snippet: ${result.snippet}`);
            output.push("");
        }

        return ok(output.join("\n"), { metadata: { query, resultCount: results.length } });
    },
});
