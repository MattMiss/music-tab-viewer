// pdf.js default styles
import "pdfjs-dist/web/pdf_viewer.css";
import PdfFolderViewer from "./components/PdfFolderViewer";

export default function App() {
    return (
        <div className="h-screen w-screen bg-gray-50 dark:bg-gray-900">
            <PdfFolderViewer />
        </div>
    );
}
