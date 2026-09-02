import { useRef } from "react";
import type { KeyBinding, TextareaRenderable } from "@opentui/core";
import { theme } from "../theme";
import { useKeyboard } from "@opentui/react";

export const TEXTAREA_KEY_BINDINGS: KeyBinding[] = [
    { name: "return", action: "submit" },
    { name: "return", shift: true, action: "newline" }, // kitty-capable terminals only
    { name: "return", meta: true, action: "newline" }, // alt+enter — works everywhere
];

type InputProps = {
    onSubmit: (text: string) => void;
    disabled?: boolean;
    notice?: string | null;
};

export const Inputbar = ({ onSubmit, disabled = false, notice = null }: InputProps) => {
    const textareaRef = useRef<TextareaRenderable>(null);

    const handleSubmit = () => {
        const textarea = textareaRef.current;
        if (!textarea || disabled) return;

        const text = textarea.plainText.trim();
        if (!text) return;

        textarea.clear();
        onSubmit(text);
    };

    useKeyboard((key) => {
        if (!key.ctrl || key.name !== "c") return;
        if (disabled) return;

        const textarea = textareaRef.current;
        if (textarea && textarea.plainText.length > 0) {
            textarea.clear();
        }
    });

    return (
        <box width="100%" flexShrink={0} flexDirection="column">
            <box
                width="100%"
                flexDirection="row"
                alignItems="flex-start"
                border={["top", "bottom"]}
                borderColor={theme.border}
            >
                <box paddingRight={1}>
                    <text fg={theme.user}>❯</text>
                </box>

                <box flexGrow={1}>
                    <textarea
                        ref={textareaRef}
                        width="100%"
                        height={1}
                        focused={true}
                        placeholder={disabled ? "Working..." : "Ask anything..."}
                        placeholderColor={theme.muted}
                        keyBindings={TEXTAREA_KEY_BINDINGS}
                        onSubmit={handleSubmit}
                    />
                </box>
            </box>

            {notice && (
                <box paddingLeft={2}>
                    <text fg={theme.warning}>{notice ?? ""}</text>
                </box>
            )}
        </box>
    );
};
