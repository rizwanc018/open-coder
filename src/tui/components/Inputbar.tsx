import { useRef, useState } from "react";
import type { KeyBinding, TextareaRenderable } from "@opentui/core";
import { theme } from "../theme";

export const TEXTAREA_KEY_BINDINGS: KeyBinding[] = [
    { name: "return", action: "submit" },
    { name: "return", shift: true, action: "newline" },  // kitty-capable terminals only
    { name: "return", meta: true, action: "newline" },   // alt+enter — works everywhere
];

type InputProps = {
    onSubmit: (text: string) => void;
    disabled?: boolean;
};

export const Inputbar = ({ onSubmit, disabled = false }: InputProps) => {
    const textareaRef = useRef<TextareaRenderable>(null);

    const handleSubmit = () => {
        const textarea = textareaRef.current;
        if (!textarea || disabled) return;

        const text = textarea.plainText.trim();
        if (!text) return;

        textarea.clear();
        onSubmit(text);
    };

    return (
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
            <box width="100%">
                <textarea
                    ref={textareaRef}
                    focused={true}
                    placeholder={disabled ? `Working... ` : `Ask anything... `}
                    placeholderColor={theme.muted}
                    keyBindings={TEXTAREA_KEY_BINDINGS}
                    onSubmit={handleSubmit}
                />
            </box>
        </box>
    );
};
