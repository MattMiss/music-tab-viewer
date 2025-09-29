import { useEffect, useMemo, useState } from "react";
import { get, set, del } from "idb-keyval";
import { useLibrary } from "../lib/useLibrary";
import { ensureReadPermission } from "../lib/fsPermissions";
import { buildItemsFromHierarchicalFolder } from "../lib/importFromFolder";
import type { LibraryItem } from "../types/library";
import type { SortKey } from "../types/library";

type FileEntry = { name: string; handle: FileSystemFileHandle };

export default function Sidebar({
    onOpenBlob,
}: {
    onOpenBlob: (blob: Blob) => void;
}) {
    const lib = useLibrary();

    // Optional “raw folder” quick-open (outside saved library)
    const [dirHandle, setDirHandle] =
        useState<FileSystemDirectoryHandle | null>(null);
    const [files, setFiles] = useState<FileEntry[]>([]);

    // Restore previously authorized raw folder (optional)
    useEffect(() => {
        (async () => {
            const saved = (await get("pdfDirHandle")) as
                | FileSystemDirectoryHandle
                | undefined;
            if (saved && (await ensureReadPermission(saved, "read")))
                setDirHandle(saved);
        })();
    }, []);

    // Load raw files when dirHandle changes
    useEffect(() => {
        if (!dirHandle) {
            setFiles([]);
            return;
        }
        (async () => {
            const next: FileEntry[] = [];
            for await (const [name, handle] of dirHandle.entries()) {
                if (
                    handle.kind === "file" &&
                    name.toLowerCase().endsWith(".pdf")
                ) {
                    next.push({ name, handle: handle as FileSystemFileHandle });
                }
            }
            next.sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { numeric: true })
            );
            setFiles(next);
            if (next[0]) onOpenBlob(await next[0].handle.getFile());
        })();
    }, [dirHandle, onOpenBlob]);

    const importFolderHierarchical = async () => {
        if (!window.showDirectoryPicker) {
            alert("Chrome/Edge desktop required.");
            return;
        }
        const root = await window.showDirectoryPicker();
        const ok = await ensureReadPermission(root, "read");
        if (!ok) return;
        const items = await buildItemsFromHierarchicalFolder(root); // recursive Band/Album/Song
        await lib.importItems(items);
        if (items[0]) onOpenBlob(await items[0].handle.getFile());
    };

    const pickFolder = async () => {
        if (!window.showDirectoryPicker) {
            alert("Chrome/Edge desktop required.");
            return;
        }
        const handle = await window.showDirectoryPicker();
        if (!(await ensureReadPermission(handle, "read"))) return;
        setDirHandle(handle);
        await set("pdfDirHandle", handle);
    };

    const forgetFolder = async () => {
        await del("pdfDirHandle");
        setDirHandle(null);
    };

    const rawList = useMemo(() => files, [files]);

    // group Band -> Album -> Songs based on the already-filtered/sorted lib.list
    const grouped = useMemo(() => {
        // Build Band -> Album -> Items map, also track latestModified per group
        const byBand = new Map<
            string,
            {
                albums: Map<
                    string,
                    { items: LibraryItem[]; latestModified: number }
                >;
                latestModified: number;
            }
        >();

        for (const it of lib.list) {
            const band = it.band || "Unknown";
            const album = it.album ?? "Single";
            const bandEntry = byBand.get(band) ?? {
                albums: new Map<
                    string,
                    { items: LibraryItem[]; latestModified: number }
                >(),
                latestModified: 0,
            };

            const albumEntry = bandEntry.albums.get(album) ?? {
                items: [] as LibraryItem[],
                latestModified: 0,
            };

            albumEntry.items.push(it);
            albumEntry.latestModified = Math.max(
                albumEntry.latestModified,
                it.lastModified
            );

            bandEntry.albums.set(album, albumEntry);
            bandEntry.latestModified = Math.max(
                bandEntry.latestModified,
                albumEntry.latestModified
            );

            byBand.set(band, bandEntry);
        }

        const dir = lib.asc ? 1 : -1;
        const cmpStr = (a: string, b: string) =>
            dir * a.localeCompare(b, undefined, { numeric: true });
        const cmpNum = (a: number, b: number) => dir * (a - b);

        // Sort bands
        const bandNames = Array.from(byBand.keys()).sort((a, b) => {
            if (lib.sortKey === "band") return cmpStr(a, b);
            if (lib.sortKey === "lastModified")
                return cmpNum(
                    byBand.get(a)!.latestModified,
                    byBand.get(b)!.latestModified
                );
            // default stable-ish alpha
            return a.localeCompare(b, undefined, { numeric: true });
        });

        return bandNames.map((band) => {
            const bandEntry = byBand.get(band)!;

            // Sort albums within band
            const albumNames = Array.from(bandEntry.albums.keys()).sort(
                (a, b) => {
                    if (lib.sortKey === "album") return cmpStr(a, b);
                    if (lib.sortKey === "lastModified")
                        return cmpNum(
                            bandEntry.albums.get(a)!.latestModified,
                            bandEntry.albums.get(b)!.latestModified
                        );
                    return a.localeCompare(b, undefined, { numeric: true });
                }
            );

            const albums = albumNames.map((album) => {
                const albumEntry = bandEntry.albums.get(album)!;

                // Sort songs within album
                const items = albumEntry.items.slice().sort((ia, ib) => {
                    if (lib.sortKey === "song") return cmpStr(ia.song, ib.song);
                    if (lib.sortKey === "lastModified")
                        return cmpNum(ia.lastModified, ib.lastModified);
                    // default alpha by song
                    return ia.song.localeCompare(ib.song, undefined, {
                        numeric: true,
                    });
                });

                return { album, items };
            });

            return { band, albums };
        });
    }, [lib.list, lib.sortKey, lib.asc]);


    return (
        <aside className="w-96 shrink-0 h-full overflow-y-auto border-r p-3 space-y-3">
            <div className="flex gap-2">
                <button
                    onClick={importFolderHierarchical}
                    className="border px-2 py-1 rounded"
                >
                    Import Band/Album/Song Folder
                </button>
            </div>

            {/* Filters & search */}
            <div className="flex gap-2">
                <input
                    className="w-full border rounded px-2 py-1"
                    placeholder="Search band/album/song…"
                    value={lib.filters.q ?? ""}
                    onChange={(e) =>
                        lib.setFilters({ ...lib.filters, q: e.target.value })
                    }
                />
            </div>

            <div className="flex gap-2">
                <select
                    className="border rounded px-2 py-1"
                    value={lib.filters.band ?? ""}
                    onChange={(e) =>
                        lib.setFilters({
                            ...lib.filters,
                            band: e.target.value || undefined,
                            album: undefined,
                        })
                    }
                    title="Filter by band"
                >
                    <option value="">
                        All bands
                    </option>
                    {Array.from(new Set(lib.items.map((i) => i.band)))
                        .sort()
                        .map((b) => (
                            <option
                                key={b}
                                value={b}
                            >
                                {b}
                            </option>
                        ))}
                </select>

                <select
                    className="border rounded px-2 py-1"
                    value={lib.filters.album ?? ""}
                    onChange={(e) =>
                        lib.setFilters({
                            ...lib.filters,
                            album: e.target.value || undefined,
                        })
                    }
                    title="Filter by album"
                    disabled={!lib.filters.band}
                >
                    <option value="">
                        All albums
                    </option>
                    {Array.from(
                        new Set(
                            lib.items
                                .filter(
                                    (i) =>
                                        !lib.filters.band ||
                                        i.band === lib.filters.band
                                )
                                .map((i) => i.album)
                                .filter((x): x is string => !!x)
                        )
                    )
                        .sort()
                        .map((a) => (
                            <option
                                key={a}
                                value={a}
                            >
                                {a}
                            </option>
                        ))}
                </select>
            </div>

            {/* Sort */}
            <div className="flex gap-2 items-center">
                <label className="text-xs opacity-70">Sort</label>
                <select
                    className="border rounded px-2 py-1"
                    value={lib.sortKey}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        lib.setSortKey(e.target.value as SortKey)
                    }
                >
                    <option value="band">Band</option>
                    <option value="album">Album</option>
                    <option value="song">Song</option>
                    <option value="lastModified">Last Modified</option>
                </select>
                <button
                    className="border rounded px-2 py-1"
                    onClick={() => lib.setAsc(!lib.asc)}
                    title="Toggle sort order"
                >
                    {lib.asc ? "Asc ↑" : "Desc ↓"}
                </button>
            </div>

            {/* Saved library list (Band → Album → Songs with Delete) */}
            <div className="space-y-4">
                {grouped.length === 0 ? (
                    <p className="text-sm opacity-70">No items found.</p>
                ) : (
                    grouped.map(({ band, albums }) => (
                        <section key={band} className="pt-2">
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
                                {band}
                            </h3>

                            <div className="mt-1 space-y-2">
                                {albums.map(({ album, items }) => (
                                    <div key={`${band}-${album}`}>
                                        <div className="text-xs font-medium text-gray-500">
                                            {album}
                                        </div>

                                        <ul className="mt-1">
                                            {items.map((item) => (
                                                <li
                                                    key={item.id}
                                                    className="flex items-center justify-between mb-1"
                                                >
                                                    {/* Open the song */}
                                                    <button
                                                        className="flex-1 text-left hover:bg-gray-100 rounded px-2 py-1"
                                                        onClick={async () => {
                                                            try {
                                                                const blob =
                                                                    await item.handle.getFile();
                                                                onOpenBlob(
                                                                    blob
                                                                );
                                                            } catch {
                                                                alert(
                                                                    "Can't open this file. It may have been moved. Re-import to relink."
                                                                );
                                                            }
                                                        }}
                                                        title={item.song}
                                                    >
                                                        {item.song}
                                                    </button>

                                                    {/* Delete from library (not from disk) */}
                                                    <button
                                                        className="ml-2 text-xs text-red-600 hover:underline px-1 py-1"
                                                        onClick={async (e) => {
                                                            e.stopPropagation(); // don’t trigger open
                                                            const ok =
                                                                window.confirm(
                                                                    `Remove "${item.song}" from your library? (The file on disk is not deleted.)`
                                                                );
                                                            if (!ok) return;
                                                            await lib.removeItem(
                                                                item.id
                                                            );
                                                        }}
                                                        aria-label={`Delete ${item.song} from library`}
                                                        title="Delete from library"
                                                    >
                                                        X
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))
                )}
            </div>

            {/* Optional: raw folder quick-open */}
            <div className="mt-4 border-t pt-3">
                <div className="flex gap-2 mb-2">
                    <button
                        onClick={pickFolder}
                        className="border px-2 py-1 rounded"
                    >
                        Choose Folder (raw)
                    </button>
                    <button
                        onClick={forgetFolder}
                        className="border px-2 py-1 rounded"
                    >
                        Forget
                    </button>
                </div>
                <div className="text-xs opacity-70 mb-2">
                    {dirHandle
                        ? "Raw folder selected"
                        : "No raw folder selected"}
                </div>
                {rawList.length > 0 && (
                    <ul className="space-y-1">
                        {rawList.map((f) => (
                            <li key={f.name}>
                                <button
                                    onClick={async () =>
                                        onOpenBlob(await f.handle.getFile())
                                    }
                                    className="w-full text-left hover:bg-gray-100 rounded px-2 py-1"
                                    title={f.name}
                                >
                                    {f.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </aside>
    );
}
