import { Header } from "./Header";

export function MessageList() {
    return (
        <scrollbox flexGrow={1} stickyScroll stickyStart="bottom">
            <Header />
        </scrollbox>
    );
}
