import { proxyArt, type CardPhoto } from "./cardPhotos";
import type { LyricRow } from "./excerpt";
import type { SearchResult } from "./types";

export type ExcerptPayload = {
  rows?: LyricRow[];
  start?: number;
  end?: number;
};

const excerpts = new Map<string, Promise<ExcerptPayload | null>>();
const photos = new Map<number, Promise<CardPhoto[]>>();
const arts = new Set<string>();

export function excerptQuery(result: SearchResult, query?: string) {
  const params = new URLSearchParams({
    title: result.title,
    artist: result.primaryArtist,
    snippet: result.snippet ?? "",
  });
  if (query) params.set("q", query);
  return `/api/excerpt?${params.toString()}`;
}

export function prefetchExcerpt(result: SearchResult, query?: string) {
  const url = excerptQuery(result, query);
  if (!excerpts.has(url)) {
    excerpts.set(
      url,
      fetch(url)
        .then((res) => (res.ok ? (res.json() as Promise<ExcerptPayload>) : null))
        .catch(() => null),
    );
  }
  return excerpts.get(url)!;
}

export function prefetchPhotos(id: number) {
  if (!photos.has(id)) {
    photos.set(
      id,
      fetch(`/api/photos?id=${id}`)
        .then((res) => (res.ok ? (res.json() as Promise<{ photos?: CardPhoto[] }>) : null))
        .then((data) => data?.photos ?? [])
        .catch(() => []),
    );
  }
  return photos.get(id)!;
}

export function prefetchCardArt(url: string | null) {
  const src = proxyArt(url);
  if (!src || arts.has(src) || typeof Image === "undefined") return;
  arts.add(src);
  const img = new Image();
  img.decoding = "async";
  img.src = src;
}

export function warmupResults(results: SearchResult[], query?: string) {
  const now = results.slice(0, 4);
  for (const result of now) {
    prefetchExcerpt(result, query);
    prefetchPhotos(result.id);
    prefetchCardArt(result.art);
  }
  const later = results.slice(4, 8);
  if (!later.length) return;
  const run = () => {
    for (const result of later) {
      prefetchExcerpt(result, query);
      prefetchPhotos(result.id);
    }
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(run);
  else setTimeout(run, 400);
}

const searchMemo = new Map<string, { at: number; data: unknown }>();

export async function fetchSearch<T>(url: string): Promise<T> {
  const hit = searchMemo.get(url);
  if (hit && Date.now() - hit.at < 45_000) return hit.data as T;
  const res = await fetch(url);
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "Search failed");
  searchMemo.set(url, { at: Date.now(), data });
  return data;
}
