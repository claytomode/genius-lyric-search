import type {
  ArtistRole,
  CatalogStreamEvent,
  GeniusArtist,
  GeniusLyricHit,
  GeniusSong,
  SearchResult,
  SortMode,
} from "./types";
import { photosFromSong, type CardPhoto } from "./cardPhotos";
import { compactGeniusImage } from "./art";
import { formatQuery, geniusQueries, parseQuery, queryFeatures } from "./query";
import { matchQuery } from "./match";
import { resolveGeniusApi } from "./geniusApi";
import { lyricsFromLrclib } from "./lrclib";
import { rankResults } from "./rank";

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "LyricSearch/1.0 (https://github.com/claytomode/genius-lyric-search)",
};

const GENIUS_PER_PAGE = 20;
const CATALOG_PAGES = 1;
const CATALOG_DEEPER_PAGES = 30;
const CATALOG_LYRIC_CONCURRENCY = 24;
const CATALOG_FIRST_LIMIT = 4;
const CATALOG_DEEPER_LIMIT = 20;
const CATALOG_FIRST_BUDGET_MS = 5_000;
const CATALOG_DEEPER_BUDGET_MS = 20_000;

type GeniusEnvelope<T> = {
  meta: { status: number };
  response: T;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geniusGet<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  originOverride?: string,
) {
  const { origin, token } = resolveGeniusApi();
  const base = originOverride ?? origin;
  const url = new URL(`${base}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const official = url.hostname === "api.genius.com";
  const headers: Record<string, string> = { ...HEADERS };
  if (token && official) headers.Authorization = `Bearer ${token}`;
  if (!official) headers.Referer = "https://genius.com/";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });

    if (res.status === 429 || res.status === 503) {
      if (attempt === 0) {
        const wait = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(wait) && wait > 0 ? Math.min(wait * 1000, 2000) : 500);
        continue;
      }
      throw new Error(`Genius request failed (${res.status})`);
    }

    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.includes("json")) {
      throw new Error(`Genius request failed (${res.status})`);
    }

    const body = (await res.json()) as GeniusEnvelope<T>;
    if (body.meta?.status && body.meta.status >= 400) {
      throw new Error("Genius request failed");
    }
    return body.response;
  }

  throw new Error("Genius request failed");
}

export async function searchArtists(q: string): Promise<GeniusArtist[]> {
  const { mode } = resolveGeniusApi();
  if (mode === "official") {
    const response = await geniusGet<{ hits: { result: GeniusSong }[] }>("search", {
      q,
      per_page: 8,
    });
    const artists: GeniusArtist[] = [];
    const seen = new Set<number>();
    for (const hit of response.hits ?? []) {
      const artist = hit.result?.primary_artist;
      if (!artist?.id || seen.has(artist.id)) continue;
      seen.add(artist.id);
      artists.push(artist);
    }
    return artists;
  }

  const response = await geniusGet<{
    sections: { hits: { result: GeniusArtist }[] }[];
  }>("search/artist", { q, per_page: 8 });

  return (response.sections?.[0]?.hits ?? []).map((hit) => hit.result);
}

function songTimestamp(song: GeniusSong): number | null {
  const parts = song.release_date_components;
  if (!parts?.year) return null;
  return Date.UTC(parts.year, (parts.month ?? 1) - 1, parts.day ?? 1);
}

function isJunkTitle(title: string) {
  return /tracklist|album art\b|credits$/i.test(title);
}

function roleOnSong(song: GeniusSong, artistId: number): "lead" | "featured" | null {
  const primaries = song.primary_artists?.length
    ? song.primary_artists
    : song.primary_artist
      ? [song.primary_artist]
      : [];
  const isLead = primaries.some((artist) => artist.id === artistId);
  const isFeatured = (song.featured_artists ?? []).some((artist) => artist.id === artistId);
  if (isLead) return "lead";
  if (isFeatured) return "featured";
  return null;
}

function matchesRole(role: "lead" | "featured", filter: ArtistRole) {
  if (filter === "both") return true;
  return role === filter;
}

function toResult(song: GeniusSong, role: "lead" | "featured", hit?: GeniusLyricHit): SearchResult {
  const lyric = hit?.highlights?.find((h) => h.property === "lyrics") ?? hit?.highlights?.[0];
  const full =
    song.song_art_image_url ||
    song.header_image_url ||
    song.song_art_image_thumbnail_url ||
    song.header_image_thumbnail_url ||
    null;
  const thumb =
    song.song_art_image_thumbnail_url ||
    song.header_image_thumbnail_url ||
    compactGeniusImage(full) ||
    full;
  return {
    id: song.id,
    title: song.title,
    url: song.url,
    art: full,
    artThumb: thumb,
    artistImage: song.primary_artist?.image_url || null,
    primaryArtist: song.primary_artist?.name ?? song.artist_names,
    primaryArtistId: song.primary_artist?.id ?? 0,
    featuredArtists: (song.featured_artists ?? []).map((artist) => artist.name),
    role,
    releaseDate: song.release_date_for_display,
    releaseTimestamp: songTimestamp(song),
    pageviews: song.stats?.pageviews ?? null,
    snippet: lyric?.value ?? null,
    ranges: lyric?.ranges ?? [],
    score: 0,
    matchKind: "any",
    nearMiss: false,
  };
}

type LyricSearchResponse = {
  hits?: GeniusLyricHit[];
  sections?: { hits: GeniusLyricHit[]; next_page?: number | null }[];
  next_page?: number | null;
};

function lyricHitsFromResponse(response: LyricSearchResponse) {
  const section = response.sections?.[0];
  return {
    hits: section?.hits ?? response.hits ?? [],
    nextPage: section?.next_page ?? response.next_page ?? null,
  };
}

async function lyricPage(q: string, page: number) {
  const { mode } = resolveGeniusApi();
  if (mode === "official") {
    return { hits: [] as GeniusLyricHit[], nextPage: null };
  }

  const response = await geniusGet<LyricSearchResponse>("search/lyric", {
    q,
    per_page: GENIUS_PER_PAGE,
    page,
  });
  return lyricHitsFromResponse(response);
}

async function songSearchPage(q: string, page: number) {
  const { mode } = resolveGeniusApi();
  try {
    if (mode === "official") {
      const response = await geniusGet<{
        hits?: { result: GeniusSong }[];
        next_page?: number | null;
      }>("search", { q, per_page: GENIUS_PER_PAGE, page });
      return {
        hits: (response.hits ?? [])
          .filter((hit) => hit.result)
          .map((hit) => ({ highlights: [] as GeniusLyricHit["highlights"], result: hit.result })),
        nextPage: response.next_page ?? null,
      };
    }
    const response = await geniusGet<LyricSearchResponse>("search/song", {
      q,
      per_page: GENIUS_PER_PAGE,
      page,
    });
    return lyricHitsFromResponse(response);
  } catch {
    return { hits: [] as GeniusLyricHit[], nextPage: null };
  }
}

function snippetFromLyrics(
  lyrics: string,
  parsed: ReturnType<typeof parseQuery>,
): { snippet: string; ranges: { start: number; end: number }[] } {
  const hit = matchQuery(parsed.ast, lyrics, 0);
  if (hit.ok && hit.ranges.length) {
    const first = Math.min(...hit.ranges.map((range) => range.start));
    const last = Math.max(...hit.ranges.map((range) => range.end));
    let start = lyrics.lastIndexOf("\n", first);
    start = start < 0 ? 0 : start + 1;
    let end = lyrics.indexOf("\n", last);
    if (end < 0) end = lyrics.length;
    const snippet = lyrics.slice(start, end).trim();
    return {
      snippet,
      ranges: hit.ranges
        .map((range) => ({ start: range.start - start, end: range.end - start }))
        .filter((range) => range.end > 0 && range.start < snippet.length),
    };
  }
  const lines = lyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\[[^\]]+\]$/.test(line));
  return { snippet: lines.slice(0, 6).join("\n"), ranges: [] };
}

async function lyricsMatch(
  result: SearchResult,
  parsed: ReturnType<typeof parseQuery>,
  lyrics: string | null,
): Promise<SearchResult | null> {
  if (result.snippet) {
    const snippetHit = matchQuery(parsed.ast, result.snippet, 0);
    if (snippetHit.ok) {
      const cut = snippetFromLyrics(result.snippet, parsed);
      return { ...result, snippet: cut.snippet, ranges: cut.ranges };
    }
  }
  if (!lyrics) return null;
  if (!matchQuery(parsed.ast, lyrics, 0).ok) return null;
  const cut = snippetFromLyrics(lyrics, parsed);
  return { ...result, snippet: cut.snippet, ranges: cut.ranges };
}

function decorateResult(
  result: SearchResult,
  parsed: ReturnType<typeof parseQuery>,
  autoFuzz: number,
): SearchResult | null {
  const snippet = result.snippet ?? "";
  const snippetMatch = matchQuery(parsed.ast, snippet, autoFuzz);
  const popularity = Math.log10((result.pageviews ?? 0) + 1);

  if (!snippetMatch.ok) {
    if (parsed.explicit) {
      const features = queryFeatures(parsed.ast);
      if (features.not) return null;
      if (!result.ranges.length) return null;
      return {
        ...result,
        score: 18 + popularity,
        matchKind: features.phrase ? "phrase" : features.proximity ? "proximity" : "any",
        nearMiss: autoFuzz > 0,
      };
    }
    return null;
  }

  return {
    ...result,
    score: snippetMatch.score + popularity,
    matchKind: snippetMatch.kind,
    nearMiss: snippetMatch.kind === "near" || snippetMatch.fuzzy,
    ranges: snippetMatch.ranges.length ? snippetMatch.ranges : result.ranges,
  };
}

function keepHit(
  hit: GeniusLyricHit,
  artistId: number | undefined,
  roleFilter: ArtistRole,
): SearchResult | null {
  const song = hit.result;
  if (!song || isJunkTitle(song.title) || song.lyrics_state === "unreleased") return null;

  let role: "lead" | "featured" = "lead";
  if (artistId) {
    const credited = roleOnSong(song, artistId);
    if (!credited || !matchesRole(credited, roleFilter)) return null;
    role = credited;
  }

  return toResult(song, role, hit);
}

async function collectFromQueries(
  queries: string[],
  opts: {
    artistId?: number;
    role: ArtistRole;
    fromPage: number;
    maxPages: number;
  },
) {
  const seen = new Set<number>();
  const collected: SearchResult[] = [];
  let scannedPages = 0;
  let nextFromPage: number | null = null;
  let exhausted = true;

  const cap = opts.artistId ? opts.maxPages : 1;
  const firstPages = await Promise.all(queries.map((query) => lyricPage(query, opts.fromPage)));
  for (const response of firstPages) {
    scannedPages += 1;
    if (response.nextPage) {
      exhausted = false;
      nextFromPage = Math.max(nextFromPage ?? 0, response.nextPage);
    }
    for (const hit of response.hits) {
      const result = keepHit(hit, opts.artistId, opts.role);
      if (!result || seen.has(result.id)) continue;
      seen.add(result.id);
      collected.push(result);
    }
  }

  if (cap > 1) {
    for (const query of queries) {
      let page = opts.fromPage + 1;
      let pagesForQuery = 1;
      while (pagesForQuery < cap) {
        const batchSize = Math.min(4, cap - pagesForQuery);
        const responses = await Promise.all(
          Array.from({ length: batchSize }, (_, i) => lyricPage(query, page + i)),
        );
        for (const response of responses) {
          scannedPages += 1;
          pagesForQuery += 1;
          if (response.nextPage) {
            exhausted = false;
            nextFromPage = Math.max(nextFromPage ?? 0, response.nextPage);
          }
          for (const hit of response.hits) {
            const result = keepHit(hit, opts.artistId, opts.role);
            if (!result || seen.has(result.id)) continue;
            seen.add(result.id);
            collected.push(result);
          }
        }
        page += batchSize;
        if (responses.every((response) => !response.nextPage)) break;
      }
    }
  }

  return { collected, scannedPages, nextFromPage: exhausted ? null : nextFromPage };
}

type ArtistSongsResponse = {
  songs: GeniusSong[];
  next_page: number | null;
};

type CatalogSong = { song: GeniusSong; role: "lead" | "featured" };

async function scanCatalogChunk(
  songs: CatalogSong[],
  parsed: ReturnType<typeof parseQuery>,
  skip: Set<number>,
  room: number,
  deadline?: number,
  onMatch?: (result: SearchResult) => void,
): Promise<SearchResult[]> {
  const found: SearchResult[] = [];
  for (let i = 0; i < songs.length && found.length < room; ) {
    if (deadline && Date.now() >= deadline) break;
    const chunk = songs.slice(i, i + CATALOG_LYRIC_CONCURRENCY);
    i += chunk.length;
    await Promise.all(
      chunk.map(async ({ song, role: credit }) => {
        try {
          if (skip.has(song.id) || found.length >= room) return;
          const result = toResult(song, credit);
          const artistName = song.primary_artist?.name ?? song.artist_names;
          const lyrics = await lyricsFromLrclib({ title: song.title, artist: artistName });
          const matched = await lyricsMatch(result, parsed, lyrics);
          if (!matched || skip.has(matched.id) || found.length >= room) return;
          skip.add(matched.id);
          found.push(matched);
          onMatch?.(matched);
        } catch {
          return;
        }
      }),
    );
  }
  return found;
}

async function fetchArtistSongPage(artistId: number, page: number) {
  return geniusGet<ArtistSongsResponse>(`artists/${artistId}/songs`, {
    per_page: 50,
    page,
    sort: "popularity",
  });
}

async function searchArtistCatalog(
  artistId: number,
  parsed: ReturnType<typeof parseQuery>,
  role: ArtistRole,
  skip: Set<number>,
  opts: {
    firstPage?: Promise<ArtistSongsResponse>;
    startPage?: number;
    maxPages: number;
    matchLimit: number;
    deadline?: number;
    onMatch?: (result: SearchResult) => void;
    onProgress?: (info: { page: number; scanned: number }) => void;
    signal?: AbortSignal;
  },
): Promise<{ results: SearchResult[]; nextPage: number | null }> {
  const found: SearchResult[] = [];
  const limit = Math.max(1, opts.matchLimit);
  let page = opts.startPage ?? 1;
  let resume: number | null = null;
  let scanned = 0;
  let pending: Promise<ArtistSongsResponse | null> = opts.firstPage ?? fetchArtistSongPage(artistId, page);

  for (let scannedPages = 0; scannedPages < opts.maxPages && found.length < limit; scannedPages += 1) {
    if (opts.signal?.aborted || (opts.deadline && Date.now() >= opts.deadline)) {
      resume = page;
      break;
    }
    let response: ArtistSongsResponse | null;
    try {
      response = await pending;
    } catch {
      resume = page;
      break;
    }
    if (!response) break;
    const next = response.next_page;
    pending =
      next && scannedPages + 1 < opts.maxPages && found.length < limit
        ? fetchArtistSongPage(artistId, next)
        : Promise.resolve(null);

    const songs: CatalogSong[] = [];
    for (const song of response.songs ?? []) {
      if (skip.has(song.id) || isJunkTitle(song.title) || song.lyrics_state === "unreleased") continue;
      const credited = roleOnSong(song, artistId);
      if (!credited || !matchesRole(credited, role)) continue;
      songs.push({ song, role: credited });
    }
    found.push(
      ...(await scanCatalogChunk(
        songs,
        parsed,
        skip,
        limit - found.length,
        opts.deadline,
        opts.onMatch,
      )),
    );
    scanned += songs.length;
    opts.onProgress?.({ page, scanned });

    if (found.length >= limit) {
      resume = page;
      break;
    }
    if (!next) {
      resume = null;
      break;
    }
    page = next;
    resume = next;
  }

  return { results: found.slice(0, limit), nextPage: resume };
}

async function verifyGeniusHits(
  results: SearchResult[],
  parsed: ReturnType<typeof parseQuery>,
  cap = 20,
) {
  const found: SearchResult[] = [];
  for (let i = 0; i < results.length && found.length < cap; ) {
    const chunk = results.slice(i, i + CATALOG_LYRIC_CONCURRENCY);
    i += chunk.length;
    const batch = await Promise.all(
      chunk.map(async (result) => {
        try {
          const matched = await lyricsMatch(result, parsed, result.snippet);
          if (matched) return matched;
          const lyrics = await lyricsFromLrclib({
            title: result.title,
            artist: result.primaryArtist,
          });
          return lyricsMatch(result, parsed, lyrics);
        } catch {
          return null;
        }
      }),
    );
    for (const item of batch) {
      if (item) found.push(item);
      if (found.length >= cap) break;
    }
  }
  return found;
}

export async function streamArtistCatalog(opts: {
  q: string;
  artistId: number;
  role: ArtistRole;
  sort: SortMode;
  startDate?: string;
  endDate?: string;
  fromPage?: number;
  skipIds?: number[];
  onEvent: (event: CatalogStreamEvent) => void;
  signal?: AbortSignal;
}) {
  const query = opts.q.trim();
  if (!query) {
    opts.onEvent({ type: "done", nextFromPage: null });
    return;
  }

  const parsed = parseQuery(query);
  const skip = new Set(opts.skipIds ?? []);
  const fromPage = Math.max(1, Math.min(200, opts.fromPage ?? 1));

  const catalog = await searchArtistCatalog(opts.artistId, parsed, opts.role, skip, {
    startPage: fromPage,
    maxPages: CATALOG_DEEPER_PAGES,
    matchLimit: CATALOG_DEEPER_LIMIT,
    deadline: Date.now() + CATALOG_DEEPER_BUDGET_MS,
    onMatch: (result) => {
      const decorated =
        decorateResult(result, parsed, 0) ??
        (parsed.explicit ? decorateResult(result, parsed, 1) : null);
      if (!decorated) return;
      const ranked = rankResults([decorated], opts.startDate, opts.endDate, opts.sort);
      if (!ranked[0]) return;
      opts.onEvent({ type: "hit", result: ranked[0] });
    },
    onProgress: (info) => opts.onEvent({ type: "progress", page: info.page, scanned: info.scanned }),
    signal: opts.signal,
  });

  opts.onEvent({ type: "done", nextFromPage: catalog.nextPage });
}

export async function searchLyrics(opts: {
  q: string;
  artistId?: number;
  role: ArtistRole;
  sort: SortMode;
  startDate?: string;
  endDate?: string;
  fromPage?: number;
  skipIds?: number[];
}) {
  const query = opts.q.trim();
  if (!query) {
    return {
      results: [] as SearchResult[],
      nextFromPage: null as number | null,
      scannedPages: 0,
      query,
      parsed: null as string | null,
      relaxed: false,
    };
  }

  const parsed = parseQuery(query);
  const fetchQs = geniusQueries(parsed.ast)
    .map((item) => item.trim())
    .filter(Boolean);
  const queries = (fetchQs.length ? fetchQs : [query]).slice(0, 2);
  const fromPage = Math.max(1, Math.min(200, opts.fromPage ?? 1));
  const skipIds = opts.skipIds ?? [];

  if (opts.artistId && skipIds.length) {
    const catalog = await searchArtistCatalog(opts.artistId, parsed, opts.role, new Set(skipIds), {
      startPage: fromPage,
      maxPages: CATALOG_DEEPER_PAGES,
      matchLimit: CATALOG_DEEPER_LIMIT,
      deadline: Date.now() + CATALOG_DEEPER_BUDGET_MS,
    });
    const decorate = (autoFuzz: number) =>
      catalog.results
        .map((result) => decorateResult(result, parsed, autoFuzz))
        .filter((result): result is SearchResult => result !== null);
    let decorated = decorate(0);
    let relaxed = false;
    if (!decorated.length && parsed.explicit) {
      decorated = decorate(1);
      relaxed = decorated.length > 0;
    }
    return {
      results: rankResults(decorated, opts.startDate, opts.endDate, opts.sort),
      nextFromPage: catalog.nextPage,
      scannedPages: 1,
      query,
      parsed: formatQuery(parsed.ast),
      relaxed,
    };
  }

  const catalogPage1 =
    opts.artistId && fromPage === 1 && resolveGeniusApi().mode !== "official"
      ? fetchArtistSongPage(opts.artistId, 1)
      : null;
  const official = resolveGeniusApi().mode === "official";
  const catalogPromise =
    opts.artistId && fromPage === 1 && !official
      ? searchArtistCatalog(opts.artistId, parsed, opts.role, new Set(), {
          firstPage: catalogPage1 ?? undefined,
          maxPages: CATALOG_PAGES,
          matchLimit: CATALOG_FIRST_LIMIT,
          deadline: Date.now() + CATALOG_FIRST_BUDGET_MS,
        })
      : null;

  const lyricPromise = official
    ? Promise.resolve({
        collected: [] as SearchResult[],
        scannedPages: 0,
        nextFromPage: null as number | null,
      })
    : collectFromQueries(queries, {
        artistId: opts.artistId,
        role: opts.role,
        fromPage,
        maxPages: 1,
      });

  const [lyricHits, titlePage] = await Promise.all([lyricPromise, songSearchPage(queries[0], fromPage)]);

  const lyricVerified = await verifyGeniusHits(lyricHits.collected, parsed, 20);
  const seen = new Set(lyricVerified.map((result) => result.id));
  const titleExtras: SearchResult[] = [];
  for (const hit of titlePage.hits) {
    const result = keepHit(hit, opts.artistId, opts.role);
    if (!result || seen.has(result.id)) continue;
    seen.add(result.id);
    titleExtras.push(result);
  }
  const titleVerified = await verifyGeniusHits(titleExtras, parsed, 8);
  let collected = [...titleVerified, ...lyricVerified];
  let scannedPages = lyricHits.scannedPages;
  let nextFromPage = opts.artistId ? 1 : lyricHits.nextFromPage ?? titlePage.nextPage;

  if (opts.artistId && fromPage === 1 && collected.length < 4 && !official) {
    const skip = new Set(collected.map((result) => result.id));
    const catalog = catalogPromise
      ? await catalogPromise
      : await searchArtistCatalog(opts.artistId, parsed, opts.role, skip, {
          firstPage: catalogPage1 ?? undefined,
          maxPages: CATALOG_PAGES,
          matchLimit: CATALOG_FIRST_LIMIT,
          deadline: Date.now() + CATALOG_FIRST_BUDGET_MS,
        });
    collected = [...collected, ...catalog.results.filter((result) => !skip.has(result.id))];
    scannedPages += 1;
    nextFromPage = catalog.nextPage;
  }

  const continueCatalog = official && Boolean(opts.artistId);
  if (continueCatalog) nextFromPage = fromPage;

  const decorate = (autoFuzz: number) =>
    collected
      .map((result) => decorateResult(result, parsed, autoFuzz))
      .filter((result): result is SearchResult => result !== null);

  let decorated = decorate(0);
  let relaxed = false;
  if (!decorated.length && parsed.explicit) {
    decorated = decorate(1);
    relaxed = decorated.length > 0;
  }

  return {
    results: rankResults(decorated, opts.startDate, opts.endDate, opts.sort),
    nextFromPage,
    scannedPages,
    query,
    parsed: formatQuery(parsed.ast),
    relaxed,
    continueCatalog,
  };
}

export async function listArtistSongs(opts: {
  artistId: number;
  role: ArtistRole;
  sort: SortMode;
  startDate?: string;
  endDate?: string;
  fromPage?: number;
}) {
  const startPage = Math.max(1, opts.fromPage ?? 1);
  const collected: SearchResult[] = [];
  let page = startPage;
  let nextFromPage: number | null = null;
  let scannedPages = 0;

  while (scannedPages < 4) {
    const response = await geniusGet<ArtistSongsResponse>(`artists/${opts.artistId}/songs`, {
      per_page: 50,
      page,
      sort: "popularity",
    });
    scannedPages += 1;

    for (const song of response.songs ?? []) {
      if (isJunkTitle(song.title)) continue;
      const role = roleOnSong(song, opts.artistId);
      if (!role || !matchesRole(role, opts.role)) continue;
      collected.push(toResult(song, role));
    }

    nextFromPage = response.next_page;
    if (!response.next_page) break;
    if (opts.role === "both" && collected.length >= 20) {
      nextFromPage = response.next_page;
      break;
    }
    page += 1;
  }

  return {
    results: rankResults(collected, opts.startDate, opts.endDate, opts.sort),
    nextFromPage,
    scannedPages,
    query: "",
    parsed: null,
    relaxed: false,
  };
}

export async function songCardPhotos(id: number): Promise<CardPhoto[]> {
  const response = await geniusGet<{ song: GeniusSong }>(`songs/${id}`, {});
  return photosFromSong(response.song);
}
