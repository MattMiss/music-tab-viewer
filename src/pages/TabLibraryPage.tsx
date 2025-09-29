import { useState } from "react";
import Sidebar from "../components/Sidebar";
import PdfViewerPanel from "../components/PdfViewerPanel";

export default function TabLibraryPage() {
    const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);

    return (
        <div className="flex h-full w-full overflow-hidden">
            <Sidebar onOpenBlob={setCurrentBlob} />
            <PdfViewerPanel blob={currentBlob} onOpenBlob={setCurrentBlob} />
        </div>
    );
}
