import { useMemo, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import PdfViewerPanel from "../components/PdfViewerPanel";
import { useLibrary } from "../lib/useLibrary";
import type { LibraryItem } from "../types/library";
import { groupAndSort, linearize } from "../lib/grouping";

export default function TabLibraryPage() {
    const lib = useLibrary();

    const [currentId, setCurrentId] = useState<string | null>(null);
    const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);

    // NEW: loading + navigation token + document version
    const [loading, setLoading] = useState(false);
    const navToken = useRef(0);
    const [docVersion, setDocVersion] = useState(0);

    const groups = useMemo(
        () => groupAndSort(lib.list, lib.sortKey, lib.asc),
        [lib.list, lib.sortKey, lib.asc]
    );
    const visibleSequence = useMemo(() => linearize(groups), [groups]);

    // Open a library item safely (cancels previous loads)
    async function openItem(item: LibraryItem) {
        navToken.current += 1;
        const token = navToken.current;

        setCurrentId(item.id); // optimistic selection for label
        setLoading(true);
        try {
            const file = await item.handle.getFile();
            if (navToken.current !== token) return; // stale result, ignore
            setCurrentBlob(file);
            setDocVersion((v) => v + 1); // force new <Document> mount
        } catch {
            if (navToken.current !== token) return;
            alert(
                "Can't open this file. It may have been moved. Re-import to relink."
            );
        } finally {
            if (navToken.current === token) setLoading(false);
        }
    }

    // Index & bounds based on the exact visible order
    const idx = useMemo(
        () => visibleSequence.findIndex((i) => i.id === currentId),
        [visibleSequence, currentId]
    );
    const canPrev = !loading && idx > 0;
    const canNext = !loading && idx >= 0 && idx < visibleSequence.length - 1;

    const goPrev = () => {
        if (canPrev) void openItem(visibleSequence[idx - 1]);
    };
    const goNext = () => {
        if (canNext) void openItem(visibleSequence[idx + 1]);
    };

    // Raw file chooser (single-file fallback) should also reset token/version
    const openRawBlob = (blob: Blob) => {
        navToken.current += 1;
        setCurrentId(null);
        setCurrentBlob(blob);
        setDocVersion((v) => v + 1);
        setLoading(false);
    };

    return (
        <div className="flex h-full w-full overflow-hidden">
            <Sidebar
                currentId={currentId}
                onSelectItem={openItem} // passes LibraryItem
                onOpenBlob={openRawBlob} // raw folder quick-open
            />
            <PdfViewerPanel
                blob={currentBlob}
                docVersion={docVersion} // NEW
                loading={loading} // NEW (to disable UI during loads)
                onOpenBlob={openRawBlob}
                onPrev={goPrev}
                onNext={goNext}
                canPrev={canPrev}
                canNext={canNext}
                currentLabel={
                    idx >= 0
                        ? `${visibleSequence[idx].band} — ${
                              visibleSequence[idx].album ?? "Single"
                          } — ${visibleSequence[idx].song}`
                        : ""
                }
            />
        </div>
    );
}
