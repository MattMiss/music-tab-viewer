import { useEffect, useMemo, useState } from "react";
import { get, set } from "idb-keyval";
import LibraryContext from "./LibraryContext";
import type {
    LibraryContextValue,
    LibraryItem,
    Filters,
    SortKey,
} from "../types/library";

const KEY = "tabLibrary_v1";

// helpers are file-local (not exported)
function indexify(items: LibraryItem[]) {
    return items;
}
async function loadLibrary(): Promise<LibraryItem[]> {
    const saved = (await get(KEY)) as { items: LibraryItem[] } | undefined;
    return saved?.items ?? [];
}
async function saveLibrary(items: LibraryItem[]) {
    await set(KEY, { items: indexify(items) });
}

export default function LibraryProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [filters, setFilters] = useState<Filters>({});
    const [sortKey, setSortKey] = useState<SortKey>("band");
    const [asc, setAsc] = useState(true);

    useEffect(() => {
        (async () => setItems(await loadLibrary()))();
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

    const value: LibraryContextValue = {
        items,
        list,
        filters,
        sortKey,
        asc,
        setFilters,
        setSortKey,
        setAsc,
        importItems,
        updateItem,
        removeItem,
    };

    return (
        <LibraryContext.Provider value={value}>
            {children}
        </LibraryContext.Provider>
    );
}
