"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ResultCard } from "./ResultCard";
import { SearchForm, type SearchValues } from "./SearchForm";
import { LyricCardModal } from "./LyricCardModal";
import { warmupResults, fetchSearch, streamCatalog } from "@/lib/prefetch";
import { rankResults } from "@/lib/rank";
import type { ArtistRole, SearchResponse, SearchResult, SortMode } from "@/lib/types";

function roleFromParam(value: string | null): ArtistRole {
  if (value === "lead" || value === "featured" || value === "both") return value;
  return "both";
}

function sortFromParam(value: string | null): SortMode {
  if (value === "newest" || value === "oldest" || value === "match" || value === "views") return value;
  return "views";
}

function resultSummary(q: string, artistName: string, count: number, showCount: boolean) {
  const countLabel = count === 1 ? "1 result" : `${count} results`;
  if (!q && artistName && !showCount) return `Songs with ${artistName}`;
  const head = showCount
    ? q
      ? `${countLabel} for "${q}"`
      : countLabel
    : q
      ? `Results for "${q}"`
      : "Results";
  return artistName ? `${head} · ${artistName}` : head;
}

export function ResultsView({ requireArtist = false }: { requireArtist?: boolean }) {
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
  const [scanning, setScanning] = useState(false);
  const [scanPct, setScanPct] = useState(0);
  const [card, setCard] = useState<SearchResult | null>(null);
  const closeCard = useCallback(() => setCard(null), []);
  const [relaxed, setRelaxed] = useState(false);
  const [scanNonce, setScanNonce] = useState(0);
  const requestId = useRef(0);
  const autoScan = useRef(false);
  const resultsRef = useRef(results);
  resultsRef.current = results;

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

  const blocked = requireArtist && Boolean(q) && !artistId;

  useEffect(() => {
    let cancelled = false;
    requestId.current += 1;
    if (blocked) {
      setResults([]);
      setNextFromPage(null);
      setRelaxed(false);
      setLoading(false);
      setScanning(false);
      autoScan.current = false;
      return;
    }
    setLoading(true);
    setResults([]);
    setScanning(false);
    setScanPct(0);
    autoScan.current = false;
    load()
      .then((data) => {
        if (cancelled) return;
        setResults(data.results);
        setNextFromPage(data.continueCatalog ? data.nextFromPage ?? 1 : data.nextFromPage);
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
  }, [load, blocked, q]);

  useEffect(() => {
    if (!requireArtist || blocked || loading || !nextFromPage || !artistId || !q) return;
    if (autoScan.current) return;
    autoScan.current = true;

    const ac = new AbortController();
    const id = requestId.current;
    const skip = resultsRef.current.map((result) => result.id);
    const page = nextFromPage;
    setScanning(true);
    setScanPct(0);

    const next = new URLSearchParams(queryString);
    next.set("fromPage", String(page));
    if (skip.length) next.set("skip", skip.join(","));

    streamCatalog(`/api/search/catalog?${next.toString()}`, ac.signal, (event) => {
      if (id !== requestId.current) return;
      if (event.type === "hit") {
        setResults((prev) => {
          if (prev.some((result) => result.id === event.result.id)) return prev;
          return rankResults([...prev, event.result], from || undefined, to || undefined, sort);
        });
        warmupResults([event.result], q);
      } else if (event.type === "progress") {
        setScanPct(Math.min(99, Math.round((event.page / 30) * 100)));
      } else if (event.type === "done") {
        setNextFromPage(event.nextFromPage);
        setScanPct(100);
      }
    })
      .catch(() => {
        if (id !== requestId.current) return;
        autoScan.current = false;
      })
      .finally(() => {
        if (id === requestId.current) setScanning(false);
      });

    return () => ac.abort();
  }, [
    requireArtist,
    blocked,
    loading,
    nextFromPage,
    artistId,
    q,
    queryString,
    from,
    to,
    sort,
    scanNonce,
  ]);

  async function loadMore() {
    if (!nextFromPage) return;
    if (requireArtist) {
      autoScan.current = false;
      setScanNonce((nonce) => nonce + 1);
      return;
    }
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

  const summary = resultSummary(
    q,
    artistName,
    results.length,
    !blocked && !(loading && results.length === 0),
  );

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
      <SearchForm values={values} onChange={setValues} compact requireArtist={requireArtist} />
      <p className="summary" aria-live="polite">
        {summary}
      </p>
      {blocked ? (
        <p className="hint">Pick an artist to search that line.</p>
      ) : null}
      {creditHint ? <p className="hint">{creditHint}</p> : null}
      {relaxed ? (
        <p className="hint">No exact hits — showing near misses (one-character typos).</p>
      ) : null}

      {loading ? (
        <p className="status" role="status">
          Searching Genius...
        </p>
      ) : null}
      {!loading && scanning && results.length === 0 ? (
        <p className="status" role="status">
          Checking {artistName || "their"} songs...
        </p>
      ) : null}
      {!loading && !scanning && results.length === 0 && !blocked ? (
        <p className="status" role="status">
          {requireArtist
            ? "No matches in their songs. Try a more specific line."
            : `No matches in the pages Genius returned. Try a more specific line${
                artistName ? `, or drop the ${artistName} filter` : ""
              }.`}
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

      {scanning ? (
        <div className="scan" role="status">
          <p className="status">
            {results.length
              ? `Checking more of ${artistName || "their"} songs...`
              : "Scanning catalog..."}
          </p>
          <div className="scan-bar" aria-hidden="true">
            <span style={{ width: `${Math.max(scanPct, 8)}%` }} />
          </div>
        </div>
      ) : null}

      {nextFromPage && !scanning ? (
        <button className="more" type="button" onClick={loadMore} disabled={loadingMore}>
          {loadingMore
            ? "Loading..."
            : requireArtist
              ? "Keep scanning"
              : artistId
                ? "Search deeper"
                : "More results"}
        </button>
      ) : null}

      {card ? <LyricCardModal result={card} query={q} onClose={closeCard} /> : null}
    </div>
  );
}
