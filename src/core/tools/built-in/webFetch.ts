import z from "zod";
import { defineTool, err, ok, TOOL_KIND } from "../types";
import { errorMessage } from "../../utils/error";
import {
    htmlToText,
    isHtmlContentType,
    isRedirect,
    isTextContentType,
    readResponseBody,
    validateUrl,
} from "../../utils/web";
import { truncateChars } from "../../utils/text";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_CONTENT_CHARS = 100 * 1024; // 100 KB
const MAX_REDIRECTS = 5;

const DEFAULT_TIMEOUT_SECONDS = 30;

type FetchMetadata = {
    url: string;
    finalUrl: string;
    statusCode: number;
    contentType: string;
    contentLengthBytes: number | null;
    returnedChars: number;
    truncated: boolean;
    redirectCount: number;
    durationMs: number;
};

const schema = z.object({
    url: z.string().describe("URL to fetch (must be http:// or https://)"),

    timeout: z
        .number()
        .int()
        .min(5)
        .max(120)
        .default(DEFAULT_TIMEOUT_SECONDS)
        .describe("Request timeout in seconds (default: 30)"),

    raw: z.boolean().default(false).describe("Return the raw response body without HTML-to-text conversion"),
});

export const webFetchTool = defineTool({
    name: "web_fetch",
    description:
        "Fetch content from a URL. HTML pages are converted to plain text; other content types are returned as-is.",
    kind: TOOL_KIND.Network,
    schema,

    async execute({ url, timeout, raw }, ctx) {
        const startedAt = Date.now();

        let parsedUrl: URL;

        try {
            parsedUrl = validateUrl(url);
        } catch (error) {
            return err(errorMessage(error));
        }
        const timeoutSignal = AbortSignal.timeout(timeout * 1000);

        const signal = ctx.signal ? AbortSignal.any([ctx.signal, timeoutSignal]) : timeoutSignal;

        let redirectCount = 0;
        let response: Response;

        try {
            while (true) {
                response = await fetch(parsedUrl, {
                    signal,
                    redirect: "manual",
                    headers: {
                        "User-Agent": "Mozilla/5.0 (compatible; open-coder/0.1)",
                    },
                });

                if (!isRedirect(response.status)) {
                    break;
                }
                if (redirectCount >= MAX_REDIRECTS) {
                    return err(`Too many redirects (maximum ${MAX_REDIRECTS})`);
                }

                const location = response.headers.get("location");

                if (!location) {
                    return err(`HTTP ${response.status}: redirect response has no Location header`);
                }

                let nextUrl: URL;

                try {
                    nextUrl = new URL(location, parsedUrl);
                } catch {
                    return err("Server returned an invalid redirect URL");
                }

                if (parsedUrl.protocol === "https:" && nextUrl.protocol === "http:") {
                    return err("HTTPS to HTTP redirects are not allowed");
                }

                parsedUrl = nextUrl;
                redirectCount++;
            }

            if (!response.ok) {
                return err(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get("content-type") ?? "";

            if (!isTextContentType(contentType)) {
                return err(
                    `Unsupported content type: ${
                        contentType || "unknown"
                    }. web_fetch only supports text-based responses.`,
                );
            }

            const contentLengthHeader = response.headers.get("content-length");

            const contentLengthBytes = contentLengthHeader ? Number(contentLengthHeader) : null;

            if (
                contentLengthBytes !== null &&
                Number.isFinite(contentLengthBytes) &&
                contentLengthBytes > MAX_RESPONSE_BYTES
            ) {
                return err(`Response is too large. Maximum allowed size is ${MAX_RESPONSE_BYTES} bytes.`);
            }

            const result = await readResponseBody(response, MAX_RESPONSE_BYTES);

            const convertedText =
                !raw && isHtmlContentType(contentType) ? htmlToText(result.body) : result.body;

            const truncateOutput = convertedText.length > MAX_CONTENT_CHARS;

            const text = truncateOutput
                ? truncateChars(convertedText, MAX_CONTENT_CHARS, "\n... [content truncated]")
                : convertedText;

            const metadata: FetchMetadata = {
                url,
                finalUrl: parsedUrl.toString(),
                statusCode: response.status,
                contentType,
                contentLengthBytes: contentLengthBytes ?? result.byteLength,
                returnedChars: text.length,
                truncated: result.truncated || truncateOutput,
                redirectCount,
                durationMs: Date.now() - startedAt,
            };

            return ok(text, {
                truncated: metadata.truncated,
                metadata,
            });
        } catch (error) {
            if (timeoutSignal.aborted) {
                return err(`Request timed out after ${timeout}s`);
            }
            return err(`Request failed: ${errorMessage(error)}`);
        }
    },
});
