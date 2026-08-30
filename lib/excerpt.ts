import type { HighlightRange } from "./types";
import type { QueryNode } from "./query";
import { matchQuery } from "./match";

export type LyricRow = {
  id: number;
  kind: "header" | "line";
  text: string;
};

type LyricLine = { start: number; end: number; text: string };

export const MAX_SNIPPET_LINES = 6;

function isSectionHeader(text: string) {
  return /^\[[^\]]+\]$/.test(text.trim());
}

function isContentLine(text: string) {
  return Boolean(text.trim()) && !isSectionHeader(text);
}

function lyricLines(lyrics: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const newline = /\r?\n/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = newline.exec(lyrics))) {
    lines.push({ start: last, end: match.index, text: lyrics.slice(last, match.index) });
    last = match.index + match[0].length;
  }
  lines.push({ start: last, end: lyrics.length, text: lyrics.slice(last) });
  return lines;
}

/** Keep nearby hits together; never span a song from the first repeat to the last. */
export function snippetAroundRanges(
  lyrics: string,
  ranges: HighlightRange[],
  maxLines = MAX_SNIPPET_LINES,
): { snippet: string; ranges: HighlightRange[] } {
  const lines = lyricLines(lyrics);
  const content = lines.filter((line) => isContentLine(line.text));
  const hits = ranges.filter((range) => range.end > range.start && range.start < lyrics.length);

  if (!content.length) return { snippet: "", ranges: [] };
  if (!hits.length) {
    const snippet = content
      .slice(0, maxLines)
      .map((line) => line.text)
      .join("\n");
    return { snippet, ranges: [] };
  }

  let best = { from: 0, to: 0, count: -1 };
  for (let from = 0; from < content.length; from++) {
    const to = Math.min(content.length - 1, from + maxLines - 1);
    const start = content[from].start;
    const end = content[to].end;
    const count = hits.filter((range) => range.start >= start && range.start <= end).length;
    if (count > best.count) best = { from, to, count };
  }

  const hitLines = content.filter(
    (line, index) =>
      index >= best.from &&
      index <= best.to &&
      hits.some((range) => range.start >= line.start && range.start <= line.end),
  );
  const lo = hitLines[0] ?? content[best.from];
  const hi = hitLines[hitLines.length - 1] ?? content[best.to];
  const snippet = lyrics.slice(lo.start, hi.end);
  return {
    snippet,
    ranges: hits
      .map((range) => ({ start: range.start - lo.start, end: range.end - lo.start }))
      .filter((range) => range.end > 0 && range.start < snippet.length),
  };
}

export function snippetForQuery(lyrics: string, ast: QueryNode, maxLines = MAX_SNIPPET_LINES) {
  const hit = matchQuery(ast, lyrics, 0);
  if (hit.ok && hit.ranges.length) return snippetAroundRanges(lyrics, hit.ranges, maxLines);
  return snippetAroundRanges(lyrics, [], maxLines);
}

export function linesFromSnippet(snippet: string, limit = 4): string[] {
  return snippet
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function rowsFromLyrics(lyrics: string, limit = 80): LyricRow[] {
  const rows: LyricRow[] = [];
  for (const raw of lyrics.replace(/\r/g, "").split("\n")) {
    const text = raw.trim();
    if (!text) continue;
    rows.push({
      id: rows.length,
      kind: isSectionHeader(text) ? "header" : "line",
      text,
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

export function suggestSelection(
  rows: LyricRow[],
  snippet: string,
  matchesLine?: (text: string) => boolean,
): { start: number; end: number } {
  const lineRows = rows.filter((row) => row.kind === "line");
  const fallbackStart = lineRows[0]?.id ?? 0;
  const fallbackEnd = lineRows[Math.min(3, lineRows.length - 1)]?.id ?? fallbackStart;

  if (matchesLine) {
    const hit = lineRows.find((row) => matchesLine(row.text));
    if (hit) return { start: hit.id, end: hit.id };
    for (let i = 0; i < lineRows.length - 1; i++) {
      if (matchesLine(`${lineRows[i].text} ${lineRows[i + 1].text}`)) {
        return { start: lineRows[i].id, end: lineRows[i + 1].id };
      }
    }
  }

  const needles = snippet
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const first = needles[0]?.slice(0, 28).toLowerCase();
  if (!first) return { start: fallbackStart, end: fallbackEnd };

  const hit = lineRows.find((row) => row.text.toLowerCase().includes(first.slice(0, 18)));
  if (!hit) return { start: fallbackStart, end: fallbackEnd };

  const index = lineRows.findIndex((row) => row.id === hit.id);
  const span = Math.min(Math.max(needles.length, 1), 4);
  const end = lineRows[Math.min(index + span - 1, lineRows.length - 1)];
  return { start: hit.id, end: end.id };
}

export function selectedLines(rows: LyricRow[], start: number, end: number): string[] {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  return rows
    .filter((row) => row.kind === "line" && row.id >= lo && row.id <= hi)
    .map((row) => row.text)
    .slice(0, 8);
}
