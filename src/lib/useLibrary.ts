import { useContext } from "react";
import LibraryContext from "./LibraryContext";
import type { LibraryContextValue } from "./../types/library";

export function useLibrary(): LibraryContextValue {
    const ctx = useContext(LibraryContext);
    if (!ctx)
        throw new Error("useLibrary must be used inside <LibraryProvider>");
    return ctx;
}
