"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ResultCard } from "./ResultCard";
import { SearchForm, type SearchValues } from "./SearchForm";
import { LyricCardModal } from "./LyricCardModal";
import { warmupResults, fetchSearch } from "@/lib/prefetch";
import type { ArtistRole, SearchResponse, SearchResult, SortMode } from "@/lib/types";

function roleFromParam(value: string | null): ArtistRole {
  if (value === "lead" || value === "featured" || value === "both") return value;
  return "both";
}

function sortFromParam(value: string | null): SortMode {
  if (value === "newest" || value === "oldest" || value === "match" || value === "views") return value;
  return "views";
}

export function ResultsView() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const artistId = params.get("artist");
  const artistName = params.get("name") ?? "";
  const role = roleFromParam(params.get("role"));
  const sort = sortFromParam(params.get("sort"));
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  const [values, setValues] = useState<SearchValues>({
    q,
    artist: artistId ? { id: Number(artistId), name: artistName || "Artist", image: null } : null,
    role,
    sort,
    from,
    to,
  });

  useEffect(() => {
    setValues({
      q,
      artist: artistId ? { id: Number(artistId), name: artistName || "Artist", image: null } : null,
      role,
      sort,
      from,
      to,
    });
  }, [q, artistId, artistName, role, sort, from, to]);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [nextFromPage, setNextFromPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [card, setCard] = useState<SearchResult | null>(null);
  const [relaxed, setRelaxed] = useState(false);
  const requestId = useRef(0);

  const queryString = useMemo(() => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (artistId) next.set("artist", artistId);
    if (role !== "both") next.set("role", role);
    if (sort !== "views") next.set("sort", sort);
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    return next.toString();
  }, [q, artistId, role, sort, from, to]);

  const load = useCallback(async (fromPage?: number, skipIds?: number[]) => {
    const next = new URLSearchParams(queryString);
    if (fromPage) next.set("fromPage", String(fromPage));
    if (skipIds?.length) next.set("skip", skipIds.join(","));
    const rev = process.env.NEXT_PUBLIC_SEARCH_REV;
    if (rev) next.set("r", rev);
    const url = `/api/search?${next.toString()}`;
    return fetchSearch<SearchResponse>(url);
  }, [queryString]);

  useEffect(() => {
    let cancelled = false;
    requestId.current += 1;
    setLoading(true);
    setResults([]);
    load()
      .then((data) => {
        if (cancelled) return;
        setResults(data.results);
        setNextFromPage(data.nextFromPage);
        setRelaxed(Boolean(data.relaxed));
        warmupResults(data.results, q);
      })
      .catch(() => {
        if (cancelled) return;
        setResults([]);
        setNextFromPage(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function loadMore() {
    if (!nextFromPage) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const data = await load(
        nextFromPage,
        artistId ? results.map((result) => result.id) : undefined,
      );
      if (id !== requestId.current) return;
      setResults((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...data.results.filter((r) => !seen.has(r.id))];
      });
      setNextFromPage(data.nextFromPage);
      warmupResults(data.results, q);
    } catch {
    } finally {
      if (id === requestId.current) setLoadingMore(false);
    }
  }

  const summary = q
    ? artistName
      ? `Results for "${q}" · ${artistName}`
      : `Results for "${q}"`
    : artistName
      ? `Songs with ${artistName}`
      : "Results";

  const creditHint =
    role === "featured"
      ? "Only songs they are credited on as a feature. Search a line from their verse - Genius dumps those under the lead artist."
      : role === "lead"
        ? "Only songs where they are the primary artist."
        : artistName
          ? "Includes songs they are on as a lead or a feature."
          : null;

  return (
    <div className="results-page">
      <SearchForm values={values} onChange={setValues} compact />
      <p className="summary">{summary}</p>
      {creditHint ? <p className="hint">{creditHint}</p> : null}
      {relaxed ? (
        <p className="hint">No exact hits — showing near misses (one-character typos).</p>
      ) : null}

      {loading ? (
        <p className="status" role="status">
          Searching Genius...
        </p>
      ) : null}
      {!loading && results.length === 0 ? (
        <p className="status" role="status">
          No matches in the pages Genius returned. Try a more specific line
          {artistName ? `, or drop the ${artistName} filter` : ""}.
        </p>
      ) : null}

      <div className="results">
        {results.map((result, index) => (
          <ResultCard
            key={result.id}
            result={result}
            artistName={artistName}
            query={q}
            priority={index < 3}
            onCard={() => setCard(result)}
          />
        ))}
      </div>

      {nextFromPage ? (
        <button className="more" type="button" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading..." : artistId ? "Search deeper" : "More results"}
        </button>
      ) : null}

      {card ? <LyricCardModal result={card} query={q} onClose={() => setCard(null)} /> : null}
    </div>
  );
}
