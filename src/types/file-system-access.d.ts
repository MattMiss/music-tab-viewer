// Minimal File System Access API typings for Chromium desktop.
// Keeps TS strict without relying on lib.dom experimental types.

type PermissionState = "granted" | "denied" | "prompt";

interface FileSystemPermissionDescriptor {
    mode?: "read" | "readwrite";
}

interface FileSystemHandle {
    kind: "file" | "directory";
    name: string;
    queryPermission?(
        descriptor?: FileSystemPermissionDescriptor
    ): Promise<PermissionState>;
    requestPermission?(
        descriptor?: FileSystemPermissionDescriptor
    ): Promise<PermissionState>;
}

interface FileSystemFileHandle extends FileSystemHandle {
    kind: "file";
    getFile(): Promise<File>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
    kind: "directory";
    // Async iterator over [name, handle]
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface Window {
    // Chromium-only
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
}
