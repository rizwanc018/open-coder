import { useRef, useState } from "react";
import type { KeyBinding, TextareaRenderable } from "@opentui/core";
import { theme } from "../theme";
import { useKeyboard } from "@opentui/react";
import { commandPrefix, completionText, filterCommands, type SlashCommand } from "../command";
import { CommandMenu } from "./CommandMenu";

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

    const [prefix, setPrefix] = useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [dismissed, setDismissed] = useState(false);

    const matches = prefix === null ? [] : filterCommands(prefix);
    const menuOpen = !disabled && !dismissed && matches.length > 0;
    const selected = matches[selectedIndex];

    const syncPrefix = () => {
        setPrefix(commandPrefix(textareaRef.current?.plainText ?? ""));
        setSelectedIndex(0);
        setDismissed(false);
    };

    const handleSubmit = () => {
        const textarea = textareaRef.current;
        if (!textarea || disabled) return;

        const text = textarea.plainText.trim();
        if (!text) return;

        textarea.clear();
        setPrefix(null);
        onSubmit(text);
    };

    const complete = (command: SlashCommand, run: boolean) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        if (run) {
            textarea.clear();
            setPrefix(null);
            onSubmit(`/${command.name}`);
            return;
        }

        textarea.setText(completionText(command));
        textarea.gotoBufferEnd();
        syncPrefix();
    };

    useKeyboard((key) => {
        if (key.ctrl && key.name === "c") {
            if (disabled) return;

            const textarea = textareaRef.current;
            if (textarea && textarea.plainText.length > 0) {
                textarea.clear();
                syncPrefix();
            }
            return;
        }

        if (!menuOpen || !selected) return;

 
        switch (key.name) {
            case "up":
                key.preventDefault();
                setSelectedIndex((index) => (index - 1 + matches.length) % matches.length);
                break;

            case "down":
                key.preventDefault();
                setSelectedIndex((index) => (index + 1) % matches.length);
                break;

            case "tab":
                key.preventDefault();
                complete(selected, false);
                break;

            case "return":
                key.preventDefault();
                complete(selected, true);
                break;

            case "escape":
                key.preventDefault();
                setDismissed(true);
                break;
        }
    });

    return (
        <box width="100%" flexShrink={0} flexDirection="column">
            {menuOpen && <CommandMenu commands={matches} selectedIndex={selectedIndex} />}

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
                        placeholder={disabled ? "Working..." : "Ask anything... (/ for commands)"}
                        placeholderColor={theme.muted}
                        keyBindings={TEXTAREA_KEY_BINDINGS}
                        onContentChange={syncPrefix}
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
