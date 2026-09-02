import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_TTL_MS = 2000;


export function useTransientNotice(ttlMs: number = DEFAULT_TTL_MS) {
    const [notice, setNotice] = useState<string | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showNotice = useCallback(
        (text: string) => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);

            setNotice(text);
            timeoutRef.current = setTimeout(() => {
                timeoutRef.current = null;
                setNotice(null);
            }, ttlMs);
        },
        [ttlMs],
    );

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return { notice, showNotice };
}
