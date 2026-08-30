import { NextRequest } from "next/server";
import { lyricsFromLrclib } from "@/lib/lrclib";
import { rowsFromLyrics, suggestSelection, linesFromSnippet } from "@/lib/excerpt";
import { parseQuery } from "@/lib/query";
import { matchQuery } from "@/lib/match";
import { cachedJson, tooMany } from "@/lib/http";
import { clip } from "@/lib/validate";

export async function GET(request: NextRequest) {
  const limited = tooMany(request, "excerpt", 20);
  if (limited) return limited;

  const title = clip(request.nextUrl.searchParams.get("title")?.trim() ?? "", 200);
  const artist = clip(request.nextUrl.searchParams.get("artist")?.trim() ?? "", 200);
  const snippet = clip(request.nextUrl.searchParams.get("snippet") ?? "", 2000);
  const q = clip(request.nextUrl.searchParams.get("q") ?? "", 200);

  try {
    const lyrics = title && artist ? await lyricsFromLrclib({ title, artist }) : null;
    const rows = lyrics
      ? rowsFromLyrics(lyrics)
      : linesFromSnippet(snippet, 12).map((text, id) => ({ id, kind: "line" as const, text }));
    const parsed = q ? parseQuery(q) : null;
    const range = suggestSelection(
      rows,
      snippet,
      parsed ? (text) => matchQuery(parsed.ast, text, 0).ok : undefined,
    );
    return cachedJson({ rows, ...range }, 3600);
  } catch (error) {
    console.error("Excerpt failed", error);
    const rows = linesFromSnippet(snippet, 12).map((text, id) => ({
      id,
      kind: "line" as const,
      text,
    }));
    return cachedJson({ rows, start: 0, end: Math.min(3, rows.length - 1) }, 60);
  }
}
