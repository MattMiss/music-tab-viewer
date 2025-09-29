import { useEffect, useRef, useState } from "react";
import { Document, Page } from "react-pdf";

export default function PdfViewerPanel({
    blob,
    docVersion, // NEW
    loading, // NEW
    onOpenBlob,
    onPrev,
    onNext,
    canPrev,
    canNext,
    currentLabel,
}: {
    blob: Blob | null;
    docVersion: number; // NEW
    loading: boolean; // NEW
    onOpenBlob: (b: Blob) => void;
    onPrev: () => void;
    onNext: () => void;
    canPrev: boolean;
    canNext: boolean;
    currentLabel?: string;
}) {
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1.1);
    const scrollRef = useRef<HTMLDivElement>(null);

    const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.1));
    const zoomIn = () => setScale((s) => Math.min(3, s + 0.1));

    // Reset scroll & page count whenever a new doc is mounted
    useEffect(() => {
        setNumPages(0);
        scrollRef.current?.scrollTo({ top: 0 });
    }, [docVersion]);

    // Keyboard: block when loading
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (loading) return;
            if (e.key === "ArrowLeft" && canPrev) onPrev();
            if (e.key === "ArrowRight" && canNext) onNext();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [loading, canPrev, canNext, onPrev, onNext]);

    return (
        <main className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
                {/* Prev/Next */}
                <button
                    className="border px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={onPrev}
                    disabled={!canPrev}
                    title="Previous song"
                >
                    ← Prev
                </button>
                <button
                    className="border px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={onNext}
                    disabled={!canNext}
                    title="Next song"
                >
                    Next →
                </button>

                <div className="ml-2 truncate text-sm opacity-80">
                    {loading ? "Loading…" : currentLabel}
                </div>

                {/* Zoom & single-file input */}
                <div className="ml-auto flex items-center gap-2">
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
                    <input
                        type="file"
                        accept="application/pdf"
                        onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (f) onOpenBlob(f);
                        }}
                    />
                </div>
            </div>

            <div
                ref={scrollRef}
                className="flex-1 overflow-auto border rounded-md p-4"
                style={{ scrollBehavior: "smooth" }}
            >
                {blob ? (
                    <Document
                        key={docVersion} // NEW: force fresh mount per doc
                        file={blob}
                        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
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
                        Pick a tab from your Library or open a PDF.
                    </p>
                )}
            </div>
        </main>
    );
}
