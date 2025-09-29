// pdf.js default styles
import "pdfjs-dist/web/pdf_viewer.css";
import PdfFolderViewer from "./components/PdfFolderViewer";
import LibraryProvider from "./lib/LibraryProvider";

export default function App() {
    return (
        <LibraryProvider>
            <div className="h-screen w-screen bg-gray-50 dark:bg-gray-900">
                <PdfFolderViewer />
            </div>
        </LibraryProvider>
    );
}
