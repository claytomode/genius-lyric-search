export type LyricRow = {
  id: number;
  kind: "header" | "line";
  text: string;
};

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
      kind: /^\[[^\]]+\]$/.test(text) ? "header" : "line",
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
