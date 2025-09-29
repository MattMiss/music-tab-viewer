import { useRef, useState } from "react";
import { Document, Page } from "react-pdf";

export default function PdfViewerPanel({
    blob,
    onOpenBlob, // for single-file fallback
}: {
    blob: Blob | null;
    onOpenBlob: (b: Blob) => void;
}) {
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1.1);
    const scrollRef = useRef<HTMLDivElement>(null);

    const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.1));
    const zoomIn = () => setScale((s) => Math.min(3, s + 0.1));

    return (
        <main className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-2 mb-2">
                <button onClick={zoomOut} className="border px-2 py-1 rounded">
                    -
                </button>
                <span>{Math.round(scale * 100)}%</span>
                <button onClick={zoomIn} className="border px-2 py-1 rounded">
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
                            onOpenBlob(f);
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
                {blob ? (
                    <Document
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
