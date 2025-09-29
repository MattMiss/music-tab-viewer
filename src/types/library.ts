// src/lib/libraryTypes.ts
export type SortKey = "band" | "album" | "song" | "lastModified";

export interface LibraryItem {
    id: string;
    band: string;
    album?: string;
    song: string;
    notes?: string;
    handle: FileSystemFileHandle;
    fileName: string;
    fileSize: number;
    lastModified: number;
}

export interface Filters {
    band?: string;
    album?: string;
    q?: string;
}

export interface LibraryContextValue {
    // state
    items: LibraryItem[];
    list: LibraryItem[]; // filtered + sorted
    filters: Filters;
    sortKey: SortKey;
    asc: boolean;

    // setters/actions
    setFilters: (f: Filters) => void;
    setSortKey: (k: SortKey) => void;
    setAsc: (v: boolean) => void;
    importItems: (newItems: LibraryItem[]) => Promise<void>;
    updateItem: (id: string, patch: Partial<LibraryItem>) => Promise<void>;
    removeItem: (id: string) => Promise<void>;
}
