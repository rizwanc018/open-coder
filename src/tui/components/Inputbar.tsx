import type { TextareaRenderable } from "@opentui/core";
import { useRef } from "react";

export const Inputbar = () => {
    const textareaRef = useRef<TextareaRenderable>(null);

    return (
        <box width="100%" flexDirection="row" alignItems="center" border={["top", "bottom"]} borderColor={"white"}>
            <box paddingRight={1}>
                <text>❯</text>
            </box>
            <box width="100%">
                <textarea ref={textareaRef} focused placeholder={`Ask anything... `} />
            </box>
        </box>
    );
};
