import { createCliRenderer, TextAttributes } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { useState } from "react";
import { MessageList } from "./components/MessageList";
import { Inputbar } from "./components/Inputbar";

function App() {

    return (
        <box
            alignItems="center"
            flexGrow={1}
            position="relative"
            width="100%"
            height="100%"
            padding={1}
            paddingLeft={0}
        >
            <MessageList />
            <Inputbar />
        </box>
    );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
