import { useEffect, useState } from "react";
import { theme, spinnerFrames, thinkingWords } from "../theme";

type SpinnerProps = {
    label?: string;
};

export function Spinner({ label }: SpinnerProps) {
    const [frame, setFrame] = useState(0);
    const [word] = useState(() => thinkingWords[Math.floor(Math.random() * thinkingWords.length)]);

    useEffect(() => {
        const timer = setInterval(() => {
            setFrame((f) => (f + 1) % spinnerFrames.length);
        }, 120);
        return () => clearInterval(timer);
    }, []);

    return (
        <box flexDirection="row" alignItems="center">
            <text fg={theme.accent}>{`${spinnerFrames[frame]} `}</text>
            <text fg={theme.accent}>{label ?? `${word}...`}</text>
        </box>
    );
}
