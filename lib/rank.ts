import type { SearchResult, SortMode } from "./types";

export function rankResults(
  results: SearchResult[],
  startDate: string | undefined,
  endDate: string | undefined,
  sort: SortMode,
) {
  const start = startDate ? Date.parse(startDate) : NaN;
  const end = endDate ? Date.parse(endDate) + 24 * 60 * 60 * 1000 - 1 : NaN;

  const filtered = results.filter((result) => {
    if (!Number.isNaN(start) || !Number.isNaN(end)) {
      if (result.releaseTimestamp == null) return false;
      if (!Number.isNaN(start) && result.releaseTimestamp < start) return false;
      if (!Number.isNaN(end) && result.releaseTimestamp > end) return false;
    }
    return true;
  });

  if (sort === "newest") {
    filtered.sort((a, b) => (b.releaseTimestamp ?? 0) - (a.releaseTimestamp ?? 0));
  } else if (sort === "oldest") {
    filtered.sort((a, b) => (a.releaseTimestamp ?? Infinity) - (b.releaseTimestamp ?? Infinity));
  } else if (sort === "views") {
    filtered.sort((a, b) => (b.pageviews ?? -1) - (a.pageviews ?? -1));
  } else {
    filtered.sort((a, b) => b.score - a.score || (b.pageviews ?? 0) - (a.pageviews ?? 0));
  }
  return filtered;
}
