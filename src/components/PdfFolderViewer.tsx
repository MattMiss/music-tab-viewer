import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import "../pdfWorker"; // sets pdfjs worker
import { get, set, del } from "idb-keyval";

import { useLibrary } from "../lib/useLibrary";
import { type SortKey } from "../types/library";
import { buildItemsFromHierarchicalFolder } from "../lib/importFromFolder";
import type { LibraryItem } from "../types/library";

type FileEntry = { name: string; handle: FileSystemFileHandle };

async function ensureReadPermission(
    handle: FileSystemHandle,
    mode: "read" | "readwrite" = "read"
): Promise<boolean> {
    if (!handle.queryPermission || !handle.requestPermission) return true;
    const state = await handle.queryPermission({ mode });
    if (state === "granted") return true;
    const requested = await handle.requestPermission({ mode });
    return requested === "granted";
}

export default function PdfFolderViewer() {
    // Direct folder browsing state (optional, can be removed if you rely only on saved library)
    const [dirHandle, setDirHandle] =
        useState<FileSystemDirectoryHandle | null>(null);
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1.1);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Saved library (band/album/song) handling
    const lib = useLibrary();

    // Restore previously authorized folder for raw folder browsing (optional convenience)
    useEffect(() => {
        (async () => {
            const saved = (await get("pdfDirHandle")) as
                | FileSystemDirectoryHandle
                | undefined;
            if (saved && (await ensureReadPermission(saved, "read"))) {
                setDirHandle(saved);
            }
        })();
    }, []);

    // Load files when dirHandle changes (for the raw folder view)
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

            if (next.length > 0) {
                const f = await next[0].handle.getFile();
                setCurrentBlob(f);
                setNumPages(0);
            }
            scrollRef.current?.scrollTo({ top: 0 });
        })();
    }, [dirHandle]);

    // ========= Actions =========

    const pickFolder = async () => {
        if (!window.showDirectoryPicker) {
            alert("Folder access requires Chrome/Edge on desktop.");
            return;
        }
        const handle = await window.showDirectoryPicker();
        if (!(await ensureReadPermission(handle, "read"))) return;
        setDirHandle(handle);
        await set("pdfDirHandle", handle); // persist for next visit (optional)
    };

    const forgetFolder = async () => {
        await del("pdfDirHandle");
        setDirHandle(null);
    };

    const openFile = async (entry: FileEntry) => {
        const file = await entry.handle.getFile();
        setCurrentBlob(file);
        setNumPages(0);
        scrollRef.current?.scrollTo({ top: 0 });
    };

    const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.1));
    const zoomIn = () => setScale((s) => Math.min(3, s + 0.1));

    const importFolderHierarchical = async () => {
        if (!window.showDirectoryPicker) {
            alert("Chrome/Edge desktop required.");
            return;
        }
        const root = await window.showDirectoryPicker();
        const ok = await ensureReadPermission(root, "read");
        if (!ok) return;
        const items = await buildItemsFromHierarchicalFolder(root);
        await lib.importItems(items);
        if (items[0]) {
            const f = await items[0].handle.getFile();
            setCurrentBlob(f);
            setNumPages(0);
            scrollRef.current?.scrollTo({ top: 0 });
        }
    };

    const fileList = useMemo(() => files, [files]);

    return (
        <div className="flex gap-4 h-[90vh]">
            {/* Sidebar: Library manager + (optional) raw folder controls */}
            <aside className="w-96 shrink-0 border rounded-md p-3 overflow-auto space-y-3">
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
                            lib.setFilters({
                                ...lib.filters,
                                q: e.target.value,
                            })
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
                        <option value="">All bands</option>
                        {Array.from(new Set(lib.items.map((i) => i.band)))
                            .sort()
                            .map((b) => (
                                <option key={b} value={b}>
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
                        <option value="">All albums</option>
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
                                <option key={a} value={a}>
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
                        onChange={(e) =>
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
                        {lib.asc ? "↑" : "↓"}
                    </button>
                </div>

                {/* Saved library list */}
                <ul className="divide-y">
                    {lib.list.map((item: LibraryItem) => (
                        <li key={item.id} className="py-2">
                            <button
                                className="w-full text-left hover:bg-gray-100 rounded px-2 py-1"
                                onClick={async () => {
                                    try {
                                        const f = await item.handle.getFile();
                                        setCurrentBlob(f);
                                        setNumPages(0);
                                        scrollRef.current?.scrollTo({ top: 0 });
                                    } catch {
                                        alert(
                                            "Can't open this file. It may have been moved. Re-import the band/album folder to relink."
                                        );
                                    }
                                }}
                                title={`${item.band} — ${
                                    item.album ?? "Single"
                                } — ${item.song}`}
                            >
                                <div className="font-medium">
                                    {item.band} — {item.album} — {item.song}
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>

                {/* Optional: raw folder quick-open (doesn't affect saved library) */}
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
                    {fileList.length > 0 && (
                        <ul className="space-y-1">
                            {fileList.map((f) => (
                                <li key={f.name}>
                                    <button
                                        onClick={() => openFile(f)}
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

            {/* Viewer */}
            <main className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center gap-2 mb-2">
                    <button
                        onClick={zoomOut}
                        className="border px-2 py-1 rounded"
                    >
                        -
                    </button>
                    <span>{Math.round(scale * 100)}%</span>
                    <button
                        onClick={zoomIn}
                        className="border px-2 py-1 rounded"
                    >
                        +
                    </button>

                    {/* Single-file fallback */}
                    <input
                        className="ml-auto"
                        type="file"
                        accept="application/pdf"
                        onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                                setCurrentBlob(f);
                                setNumPages(0);
                                scrollRef.current?.scrollTo({ top: 0 });
                            }
                        }}
                    />
                </div>

                <div
                    ref={scrollRef}
                    className="flex-1 overflow-auto border rounded-md p-4"
                    style={{ scrollBehavior: "smooth" }}
                >
                    {currentBlob ? (
                        <Document
                            file={currentBlob}
                            onLoadSuccess={({ numPages }) =>
                                setNumPages(numPages)
                            }
                            loading={<p>Loading PDF…</p>}
                            error={<p>Failed to load PDF.</p>}
                        >
                            {/* Center pages horizontally */}
                            <div className="w-full flex flex-col gap-6">
                                {Array.from({ length: numPages }, (_, i) => (
                                    <div key={i} className="w-fit mx-auto">
                                        <Page
                                            pageNumber={i + 1}
                                            scale={scale}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                        />
                                    </div>
                                ))}
                            </div>
                        </Document>
                    ) : (
                        <p className="opacity-80">
                            Pick a tab from your Library or open a PDF.
                        </p>
                    )}
                </div>
            </main>
        </div>
    );
}
