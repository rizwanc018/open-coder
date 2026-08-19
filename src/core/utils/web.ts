export const htmlToText = (html: string): string => {
    return html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n\s*\n+/g, "\n\n")
        .trim();
};

export const validateUrl = (url: string): URL => {
    let parsedUrl: URL;

    try {
        parsedUrl = new URL(url);
    } catch {
        throw new Error("Invalid URL");
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new Error("URL must use http:// or https://");
    }

    if (parsedUrl.username || parsedUrl.password) {
        throw new Error("URLs containing username/password credentials are not allowed");
    }

    if (!parsedUrl.hostname) {
        throw new Error("URL must contain a hostname");
    }

    return parsedUrl;
};

export const isRedirect = (status: number): boolean => {
    return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
};

export const readResponseBody = async (
    response: Response,
    maxBytes: number,
): Promise<{ body: string; byteLength: number; truncated: boolean }> => {
    if (!response.body) {
        return {
            body: "",
            byteLength: 0,
            truncated: false,
        };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    let truncated = false;

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            if (!value) continue;

            const remaining = maxBytes - totalBytes;

            if (remaining <= 0) {
                truncated = true;
                await reader.cancel();
                break;
            }

            if (value.byteLength > remaining) {
                chunks.push(value.slice(0, remaining));
                totalBytes += remaining;
                truncated = true;

                await reader.cancel();
                break;
            }

            chunks.push(value);
            totalBytes += value.byteLength;
        }
    } finally {
        reader.releaseLock();
    }

    let body = "";

    for (const chunk of chunks) {
        body += decoder.decode(chunk, {
            stream: true,
        });
    }

    body += decoder.decode();

    return {
        body,
        byteLength: totalBytes,
        truncated,
    };
};

export const isTextContentType = (contentType: string): boolean => {
    const type = (contentType.split(";", 1)[0] ?? "").trim().toLowerCase();

    return (
        type.startsWith("text/") ||
        type === "application/json" ||
        type === "application/ld+json" ||
        type === "application/xml" ||
        type === "application/javascript" ||
        type === "application/x-javascript" ||
        type === "application/xhtml+xml"
    );
};

export const isHtmlContentType = (contentType: string): boolean => {
    const type = (contentType.split(";", 1)[0] ?? "").trim().toLowerCase();

    return type === "text/html" || type === "application/xhtml+xml";
};