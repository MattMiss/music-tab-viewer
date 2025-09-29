export type LibraryItemId = string;

export interface LibraryItem {
    id: LibraryItemId;
    band: string;
    album?: string;
    song: string;
    notes?: string;
    handle: FileSystemFileHandle;
    fileName: string;
    fileSize: number;
    lastModified: number;
}
