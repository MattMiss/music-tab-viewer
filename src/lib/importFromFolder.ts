import type { LibraryItem } from "../types/library";

export interface FoundFile {
    handle: FileSystemFileHandle;
    segments: string[]; // e.g. ["Band", "Album", "Song.pdf"]
}

/** Recursively walk a directory and collect PDFs with path segments relative to the picked dir. */
export async function* walkPdfsWithSegments(
    dir: FileSystemDirectoryHandle,
    parentSegments: string[] = []
): AsyncGenerator<FoundFile> {
    for await (const [name, handle] of dir.entries()) {
        if (handle.kind === "file") {
            if (name.toLowerCase().endsWith(".pdf")) {
                yield {
                    handle: handle as FileSystemFileHandle,
                    segments: [...parentSegments, name],
                };
            }
        } else if (handle.kind === "directory") {
            // Recurse
            yield* walkPdfsWithSegments(handle as FileSystemDirectoryHandle, [
                ...parentSegments,
                name,
            ]);
        }
    }
}

function stripPdfExt(name: string) {
    return name.replace(/\.pdf$/i, "");
}

function parseMetaFromSegments(segments: string[]): {
    band: string;
    album?: string;
    song: string;
} {
    // Expecting ["Band", "Album", "Song.pdf"] or ["Band", "Song.pdf"]
    if (segments.length >= 3) {
        const song = stripPdfExt(segments[segments.length - 1] ?? "");
        const album = segments[segments.length - 2] ?? "";
        const band = segments[segments.length - 3] ?? "Unknown";
        return { band, album, song };
    }
    if (segments.length === 2) {
        const song = stripPdfExt(segments[1] ?? "");
        const band = segments[0] ?? "Unknown";
        return { band, song };
    }
    // Fallback: only file name
    const song = stripPdfExt(segments[0] ?? "Unknown");
    return { band: "Unknown", song };
}

function makeId(fileName: string, lastModified: number) {
    return `${fileName}:${lastModified}`;
}

/** Build LibraryItems from a directory using Band/Album/Song.pdf heuristic. */
export async function buildItemsFromHierarchicalFolder(
    rootDir: FileSystemDirectoryHandle
): Promise<LibraryItem[]> {
    const items: LibraryItem[] = [];
    for await (const found of walkPdfsWithSegments(rootDir, [])) {
        const file = await found.handle.getFile();
        const meta = parseMetaFromSegments(found.segments);
        items.push({
            id: makeId(file.name, file.lastModified),
            handle: found.handle,
            band: meta.band,
            album: meta.album,
            song: meta.song,
            fileName: file.name,
            fileSize: file.size,
            lastModified: file.lastModified,
        });
    }
    return items;
}
