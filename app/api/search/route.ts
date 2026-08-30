import { NextRequest } from "next/server";
import { listArtistSongs, searchLyrics } from "@/lib/genius";
import { jsonError, noStore, cachedJson, tooMany } from "@/lib/http";
import { asArtistId, asDate, asIdList, clampPage, clip } from "@/lib/validate";
import type { ArtistRole, SortMode } from "@/lib/types";

export const maxDuration = 30;

function asRole(value: string | null): ArtistRole {
  if (value === "lead" || value === "featured" || value === "both") return value;
  return "both";
}

function asSort(value: string | null): SortMode {
  if (value === "newest" || value === "oldest" || value === "match" || value === "views") return value;
  return "views";
}

export async function GET(request: NextRequest) {
  const limited = tooMany(request, "search", 20);
  if (limited) return limited;

  const { searchParams } = request.nextUrl;
  const q = clip(searchParams.get("q") ?? "", 200);
  const artistId = asArtistId(searchParams.get("artist"));
  const role = asRole(searchParams.get("role"));
  const sort = asSort(searchParams.get("sort"));
  const startDate = asDate(searchParams.get("from"));
  const endDate = asDate(searchParams.get("to"));
  const fromPage = clampPage(searchParams.get("fromPage"));
  const skipIds = asIdList(searchParams.get("skip"));

  try {
    if (!q.trim() && artistId) {
      const data = await listArtistSongs({
        artistId,
        role,
        sort,
        startDate,
        endDate,
        fromPage,
      });
      return skipIds.length ? noStore(data) : cachedJson(data, 60, 60);
    }

    if (!q.trim()) {
      return noStore({
        results: [],
        nextFromPage: null,
        scannedPages: 0,
        query: "",
        parsed: null,
        relaxed: false,
      });
    }

    const data = await searchLyrics({
      q,
      artistId,
      role,
      sort,
      startDate,
      endDate,
      fromPage,
      skipIds,
    });
    return skipIds.length ? noStore(data) : cachedJson(data, 45, 45);
  } catch (error) {
    if (q.trim() && artistId && skipIds.length) {
      console.error("Search failed", error);
      return noStore({
        results: [],
        nextFromPage: fromPage,
        scannedPages: 0,
        query: q,
        parsed: null,
        relaxed: false,
      });
    }
    return jsonError("Search failed", 502, error);
  }
}
