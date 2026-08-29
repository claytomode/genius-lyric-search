import { NextRequest, NextResponse } from "next/server";
import { lyricsFromLrclib } from "@/lib/lrclib";
import { rowsFromLyrics, suggestSelection, linesFromSnippet } from "@/lib/excerpt";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title")?.trim() ?? "";
  const artist = request.nextUrl.searchParams.get("artist")?.trim() ?? "";
  const snippet = request.nextUrl.searchParams.get("snippet") ?? "";

  try {
    const lyrics = title && artist ? await lyricsFromLrclib({ title, artist }) : null;
    const rows = lyrics
      ? rowsFromLyrics(lyrics)
      : linesFromSnippet(snippet, 12).map((text, id) => ({ id, kind: "line" as const, text }));
    const range = suggestSelection(rows, snippet);
    return NextResponse.json({ rows, ...range });
  } catch {
    const rows = linesFromSnippet(snippet, 12).map((text, id) => ({
      id,
      kind: "line" as const,
      text,
    }));
    return NextResponse.json({ rows, start: 0, end: Math.min(3, rows.length - 1) });
  }
}
