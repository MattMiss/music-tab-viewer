import LibraryProvider from "./lib/LibraryProvider";
import TabLibraryPage from "./pages/TabLibraryPage";
import "./pdfWorker"; // ensure worker is set once
// If you enable text/annotation layers later, you may also import:
// import "pdfjs-dist/web/pdf_viewer.css";

export default function App() {
    return (
        <LibraryProvider>
            <div className="h-screen w-screen overflow-hidden">
                <TabLibraryPage />
            </div>
        </LibraryProvider>
    );
}
