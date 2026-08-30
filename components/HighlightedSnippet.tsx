import type { HighlightRange } from "@/lib/types";
import { MAX_SNIPPET_LINES, snippetAroundRanges } from "@/lib/excerpt";

function mergeRanges(text: string, ranges: HighlightRange[]) {
  const sorted = [...ranges].filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
  const merged: HighlightRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else if (last && text.slice(last.end, range.start).trim() === "") {
      last.end = range.end;
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export function HighlightedSnippet({
  text,
  ranges,
}: {
  text: string;
  ranges: HighlightRange[];
}) {
  const lineCount = text.split(/\r?\n/).filter((line) => line.trim()).length;
  const cut =
    lineCount > MAX_SNIPPET_LINES ? snippetAroundRanges(text, ranges) : { snippet: text, ranges };
  const merged = mergeRanges(cut.snippet, cut.ranges);
  const parts: { text: string; hit: boolean }[] = [];
  let cursor = 0;

  for (const range of merged) {
    const start = Math.max(0, Math.min(cut.snippet.length, range.start));
    const end = Math.max(start, Math.min(cut.snippet.length, range.end));
    if (cursor < start) parts.push({ text: cut.snippet.slice(cursor, start), hit: false });
    if (end > start) parts.push({ text: cut.snippet.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < cut.snippet.length) parts.push({ text: cut.snippet.slice(cursor), hit: false });

  return (
    <p className="snippet">
      {parts.map((part, index) =>
        part.hit ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>,
      )}
    </p>
  );
}
