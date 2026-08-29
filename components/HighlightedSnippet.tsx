import type { HighlightRange } from "@/lib/types";

function mergeRanges(ranges: HighlightRange[]) {
  const sorted = [...ranges].filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
  const merged: HighlightRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
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
  const merged = mergeRanges(ranges);
  const parts: { text: string; hit: boolean }[] = [];
  let cursor = 0;

  for (const range of merged) {
    const start = Math.max(0, Math.min(text.length, range.start));
    const end = Math.max(start, Math.min(text.length, range.end));
    if (cursor < start) parts.push({ text: text.slice(cursor, start), hit: false });
    if (end > start) parts.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });

  return (
    <p className="snippet">
      {parts.map((part, index) =>
        part.hit ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>,
      )}
    </p>
  );
}
