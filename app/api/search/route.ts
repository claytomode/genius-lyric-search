import { NextRequest, NextResponse } from "next/server";
import { listArtistSongs, searchLyrics } from "@/lib/genius";
import type { ArtistRole, SortMode } from "@/lib/types";

function asRole(value: string | null): ArtistRole {
  if (value === "lead" || value === "featured" || value === "both") return value;
  return "both";
}

function asSort(value: string | null): SortMode {
  if (value === "newest" || value === "oldest" || value === "match") return value;
  return "match";
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") ?? "";
  const artistId = Number(searchParams.get("artist") ?? "");
  const role = asRole(searchParams.get("role"));
  const sort = asSort(searchParams.get("sort"));
  const startDate = searchParams.get("from") || undefined;
  const endDate = searchParams.get("to") || undefined;
  const fromPage = Number(searchParams.get("fromPage") ?? "1") || 1;

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
      return NextResponse.json(data);
    }

    if (!q.trim()) {
      return NextResponse.json({
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
      artistId: Number.isFinite(artistId) && artistId > 0 ? artistId : undefined,
      role,
      sort,
      startDate,
      endDate,
      fromPage,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
