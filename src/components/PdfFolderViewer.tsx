import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import "../pdfWorker"; // sets pdfjs worker
import { get, set, del } from "idb-keyval";

type FileEntry = { name: string; handle: FileSystemFileHandle };

async function ensureReadPermission(
    handle: FileSystemHandle,
    mode: "read" | "readwrite" = "read"
): Promise<boolean> {
    if (!handle.queryPermission || !handle.requestPermission) return true; // older/other browsers (we gate feature elsewhere)
    const state = await handle.queryPermission({ mode });
    if (state === "granted") return true;
    const requested = await handle.requestPermission({ mode });
    return requested === "granted";
}

export default function PdfFolderViewer() {
    const [dirHandle, setDirHandle] =
        useState<FileSystemDirectoryHandle | null>(null);
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1.1);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Restore previously authorized folder (Chromium allows handles in IndexedDB)
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

    // Load files when dirHandle changes
    useEffect(() => {
        if (!dirHandle) {
            setFiles([]);
            setCurrentBlob(null);
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
            } else {
                setCurrentBlob(null);
            }
            scrollRef.current?.scrollTo({ top: 0 });
        })();
    }, [dirHandle]);

    const pickFolder = async () => {
        if (!window.showDirectoryPicker) {
            alert("Folder access requires Chrome/Edge on desktop.");
            return;
        }
        const handle = await window.showDirectoryPicker();
        if (!(await ensureReadPermission(handle, "read"))) return;
        setDirHandle(handle);
        await set("pdfDirHandle", handle); // persist for next visit
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

    const fileList = useMemo(() => files, [files]);

    return (
        <div className="flex gap-4 h-[90vh]">
            {/* Sidebar */}
            <aside className="w-72 shrink-0 border rounded-md p-3 overflow-auto">
                <div className="flex gap-2 mb-3">
                    <button
                        onClick={pickFolder}
                        className="border px-2 py-1 rounded"
                    >
                        Choose Folder
                    </button>
                    <button
                        onClick={forgetFolder}
                        className="border px-2 py-1 rounded"
                    >
                        Forget
                    </button>
                </div>
                <div className="text-xs opacity-70 mb-2">
                    {dirHandle ? "Folder selected" : "No folder selected"}
                </div>
                {fileList.length === 0 ? (
                    <p className="text-sm opacity-80">No PDFs found.</p>
                ) : (
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
            </aside>

            {/* Viewer */}
            <main className="flex-1 flex flex-col w-full">
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

                    {/* Optional single-file fallback */}
                    <input
                        className="ml-auto"
                        type="file"
                        accept="application/pdf"
                        onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                                setDirHandle(null);
                                setFiles([]);
                                setCurrentBlob(f);
                                setNumPages(0);
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
                            Pick a folder or select a PDF.
                        </p>
                    )}
                </div>
            </main>
        </div>
    );
}
