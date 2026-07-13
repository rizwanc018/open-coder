import { useRef, useState } from "react";
import type { KeyBinding, TextareaRenderable } from "@opentui/core";

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

    return (
        <box
            width="100%"
            flexDirection="row"
            alignItems="flex-start"
            border={["top", "bottom"]}
            borderColor={"white"}
        >
            <box paddingRight={1}>
                <text>❯</text>
            </box>
            <box width="100%">
                <textarea
                    ref={textareaRef}
                    focused={true}
                    placeholder={`Ask anything... `}
                    keyBindings={TEXTAREA_KEY_BINDINGS}
                />
            </box>
        </box>
    );
};
