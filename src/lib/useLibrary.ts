import { useEffect, useMemo, useState } from "react";
import { loadLibrary, saveLibrary } from "./libraryStore";
import type { LibraryItem } from "../types/library";

export type SortKey = "band" | "album" | "song" | "lastModified";
export interface Filters {
    band?: string;
    album?: string;
    q?: string;
}

export function useLibrary() {
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [filters, setFilters] = useState<Filters>({});
    const [sortKey, setSortKey] = useState<SortKey>("band");
    const [asc, setAsc] = useState(true);

    useEffect(() => {
        (async () => {
            const lib = await loadLibrary();
            setItems(lib.items);
        })();
    }, []);

    const filtered = useMemo(() => {
        const q = filters.q?.toLowerCase() ?? "";
        return items.filter(
            (i) =>
                (!filters.band || i.band === filters.band) &&
                (!filters.album || i.album === filters.album) &&
                (!q ||
                    `${i.band} ${i.album ?? ""} ${i.song}`
                        .toLowerCase()
                        .includes(q))
        );
    }, [items, filters]);

    const list = useMemo(() => {
        const arr = [...filtered];
        arr.sort((a, b) => {
            const av = (a[sortKey] ?? "") as string | number;
            const bv = (b[sortKey] ?? "") as string | number;
            if (typeof av === "number" && typeof bv === "number")
                return asc ? av - bv : bv - av;
            return asc
                ? String(av).localeCompare(String(bv), undefined, {
                      numeric: true,
                  })
                : String(bv).localeCompare(String(av), undefined, {
                      numeric: true,
                  });
        });
        return arr;
    }, [filtered, sortKey, asc]);

    async function importItems(newItems: LibraryItem[]) {
        const map = new Map(items.map((i) => [i.id, i]));
        newItems.forEach((n) => map.set(n.id, n));
        const next = Array.from(map.values());
        setItems(next);
        await saveLibrary(next);
    }

    async function updateItem(id: string, patch: Partial<LibraryItem>) {
        const next = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
        setItems(next);
        await saveLibrary(next);
    }

    async function removeItem(id: string) {
        const next = items.filter((i) => i.id !== id);
        setItems(next);
        await saveLibrary(next);
    }

    return {
        items,
        list,
        filters,
        setFilters,
        sortKey,
        setSortKey,
        asc,
        setAsc,
        importItems,
        updateItem,
        removeItem,
    };
}
