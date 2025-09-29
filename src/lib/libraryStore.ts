import { get, set } from "idb-keyval";
import type { LibraryItem } from "../types/library";

const KEY = "tabLibrary_v1";

export interface LibraryState {
    items: LibraryItem[];
    bands: string[];
    albums: string[];
    songs: string[];
}

export async function loadLibrary(): Promise<LibraryState> {
    const lib = (await get(KEY)) as LibraryState | undefined;
    if (lib?.items) return indexify(lib.items);
    return indexify([]);
}

export async function saveLibrary(items: LibraryItem[]): Promise<void> {
    await set(KEY, indexify(items));
}

function indexify(items: LibraryItem[]): LibraryState {
    const bands = Array.from(new Set(items.map((i) => i.band))).sort();
    const albums = Array.from(new Set(items.map((i) => i.album ?? "")))
        .filter(Boolean)
        .sort();
    const songs = Array.from(new Set(items.map((i) => i.song))).sort();
    return { items, bands, albums, songs };
}
