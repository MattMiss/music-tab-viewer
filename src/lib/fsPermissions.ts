export async function ensureReadPermission(
    handle: FileSystemHandle,
    mode: "read" | "readwrite" = "read"
): Promise<boolean> {
    if (!handle.queryPermission || !handle.requestPermission) return true;
    const state = await handle.queryPermission({ mode });
    if (state === "granted") return true;
    const requested = await handle.requestPermission({ mode });
    return requested === "granted";
}
