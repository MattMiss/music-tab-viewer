// src/lib/grouping.ts
import type { LibraryItem } from "../types/library";
import type { SortKey } from "../types/library";

export interface GroupedAlbum {
    album: string;
    items: LibraryItem[];
    latestModified: number;
}
export interface GroupedBand {
    band: string;
    albums: GroupedAlbum[];
    latestModified: number;
}

/** Build Band → Album → Songs groups, sorted to match the sidebar rules. */
export function groupAndSort(
    items: LibraryItem[],
    sortKey: SortKey,
    asc: boolean
): GroupedBand[] {
    // Build maps with latestModified rollups
    const byBand = new Map<
        string,
        {
            albums: Map<
                string,
                { items: LibraryItem[]; latestModified: number }
            >;
            latestModified: number;
        }
    >();

    for (const it of items) {
        const band = it.band || "Unknown";
        const album = it.album ?? "Single";

        let bandEntry = byBand.get(band);
        if (!bandEntry) {
            bandEntry = { albums: new Map(), latestModified: 0 };
            byBand.set(band, bandEntry);
        }

        let albumEntry = bandEntry.albums.get(album);
        if (!albumEntry) {
            albumEntry = { items: [], latestModified: 0 };
            bandEntry.albums.set(album, albumEntry);
        }

        albumEntry.items.push(it);
        albumEntry.latestModified = Math.max(
            albumEntry.latestModified,
            it.lastModified
        );
        bandEntry.latestModified = Math.max(
            bandEntry.latestModified,
            albumEntry.latestModified
        );
    }

    const dir = asc ? 1 : -1;
    const cmpStr = (a: string, b: string) =>
        dir * a.localeCompare(b, undefined, { numeric: true });
    const cmpNum = (a: number, b: number) => dir * (a - b);

    // Sort bands
    const bandNames = Array.from(byBand.keys()).sort((a, b) => {
        if (sortKey === "band") return cmpStr(a, b);
        if (sortKey === "lastModified")
            return cmpNum(
                byBand.get(a)!.latestModified,
                byBand.get(b)!.latestModified
            );
        return a.localeCompare(b, undefined, { numeric: true });
    });

    return bandNames.map((band) => {
        const bandEntry = byBand.get(band)!;

        // Sort albums within the band
        const albumNames = Array.from(bandEntry.albums.keys()).sort((a, b) => {
            if (sortKey === "album") return cmpStr(a, b);
            if (sortKey === "lastModified")
                return cmpNum(
                    bandEntry.albums.get(a)!.latestModified,
                    bandEntry.albums.get(b)!.latestModified
                );
            return a.localeCompare(b, undefined, { numeric: true });
        });

        const albums: GroupedAlbum[] = albumNames.map((album) => {
            const albumEntry = bandEntry.albums.get(album)!;
            const itemsSorted = albumEntry.items.slice().sort((ia, ib) => {
                if (sortKey === "song") return cmpStr(ia.song, ib.song);
                if (sortKey === "lastModified")
                    return cmpNum(ia.lastModified, ib.lastModified);
                return ia.song.localeCompare(ib.song, undefined, {
                    numeric: true,
                });
            });
            return {
                album,
                items: itemsSorted,
                latestModified: albumEntry.latestModified,
            };
        });

        return { band, albums, latestModified: bandEntry.latestModified };
    });
}

/** Flatten groups to the exact visible sequence used for navigation. */
export function linearize(groups: GroupedBand[]): LibraryItem[] {
    const seq: LibraryItem[] = [];
    for (const g of groups) {
        for (const a of g.albums) {
            for (const it of a.items) seq.push(it);
        }
    }
    return seq;
}
