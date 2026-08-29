import type {
  ArtistRole,
  GeniusArtist,
  GeniusLyricHit,
  GeniusSong,
  SearchResult,
  SortMode,
} from "./types";
import { photosFromSong, type CardPhoto } from "./cardPhotos";
import { formatQuery, geniusQueries, parseQuery, queryFeatures } from "./query";
import { matchQuery } from "./match";
import { resolveGeniusApi } from "./geniusApi";

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "LyricSearch/1.0 (https://github.com/claytomode/genius-lyric-search)",
};

const GENIUS_PER_PAGE = 20;
const MAX_SCAN_PAGES = 4;

type GeniusEnvelope<T> = {
  meta: { status: number };
  response: T;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geniusGet<T>(path: string, params: Record<string, string | number | undefined>) {
  const { origin, token } = resolveGeniusApi();
  const url = new URL(`${origin}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { ...HEADERS };
  if (token) headers.Authorization = `Bearer ${token}`;

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
  return {
    id: song.id,
    title: song.title,
    url: song.url,
    art: song.song_art_image_url || song.header_image_url || song.song_art_image_thumbnail_url || song.header_image_thumbnail_url || null,
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

function applyDateAndSort(
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
  } else {
    filtered.sort((a, b) => b.score - a.score || (b.pageviews ?? 0) - (a.pageviews ?? 0));
  }
  return filtered;
}

type LyricSearchResponse = {
  hits?: GeniusLyricHit[];
  sections?: { hits: GeniusLyricHit[]; next_page?: number | null }[];
  next_page?: number | null;
};

async function lyricPage(q: string, page: number) {
  const response = await geniusGet<LyricSearchResponse>("search/lyric", {
    q,
    per_page: GENIUS_PER_PAGE,
    page,
  });
  const section = response.sections?.[0];
  return {
    hits: section?.hits ?? response.hits ?? [],
    nextPage: section?.next_page ?? response.next_page ?? null,
  };
}

function decorateResult(
  result: SearchResult,
  parsed: ReturnType<typeof parseQuery>,
  autoFuzz: number,
): SearchResult | null {
  const snippet = result.snippet ?? "";
  const snippetMatch = matchQuery(parsed.ast, snippet, autoFuzz);
  const titleHit = matchQuery(parsed.ast, result.title, autoFuzz);
  const popularity = Math.log10((result.pageviews ?? 0) + 1);
  const titleBoost = titleHit.ok ? 50 : 0;
  const matchOk = snippetMatch.ok || titleHit.ok;

  if (parsed.explicit && !matchOk) {
    const features = queryFeatures(parsed.ast);
    if (features.not) return null;
    if (!result.ranges.length) return null;
    return {
      ...result,
      score: 18 + popularity + titleBoost,
      matchKind: features.phrase ? "phrase" : features.proximity ? "proximity" : "any",
      nearMiss: autoFuzz > 0,
    };
  }

  return {
    ...result,
    score: (snippetMatch.ok ? snippetMatch.score : titleHit.ok ? 12 : 1) + popularity + titleBoost,
    matchKind: snippetMatch.ok ? snippetMatch.kind : titleHit.ok ? "any" : "any",
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

  for (const query of queries) {
    let page = opts.fromPage;
    let pagesForQuery = 0;
    const cap = opts.artistId ? opts.maxPages : 1;
    while (pagesForQuery < cap) {
      const batchSize = opts.artistId ? Math.min(4, cap - pagesForQuery) : 1;
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
      if (!opts.artistId) break;
    }
  }

  return { collected, scannedPages, nextFromPage: exhausted ? null : nextFromPage };
}

type ArtistSongsResponse = {
  songs: GeniusSong[];
  next_page: number | null;
};

async function searchArtistSongTitles(
  artistId: number,
  q: string,
  role: ArtistRole,
): Promise<SearchResult[]> {
  const collected: SearchResult[] = [];
  let page = 1;
  for (let scanned = 0; scanned < 3; scanned += 1) {
    try {
      const response = await geniusGet<ArtistSongsResponse>(`artists/${artistId}/songs/search`, {
        q,
        per_page: 20,
        page,
      });
      for (const song of response.songs ?? []) {
        if (isJunkTitle(song.title) || song.lyrics_state === "unreleased") continue;
        const credited = roleOnSong(song, artistId);
        if (!credited || !matchesRole(credited, role)) continue;
        collected.push(toResult(song, credited));
      }
      if (!response.next_page) break;
      page = response.next_page;
    } catch {
      break;
    }
  }
  return collected;
}

export async function searchLyrics(opts: {
  q: string;
  artistId?: number;
  role: ArtistRole;
  sort: SortMode;
  startDate?: string;
  endDate?: string;
  fromPage?: number;
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
  const fromPage = Math.max(1, Math.min(40, opts.fromPage ?? 1));

  const [lyricHits, catalogHits] = await Promise.all([
    collectFromQueries(queries, {
      artistId: opts.artistId,
      role: opts.role,
      fromPage,
      maxPages: MAX_SCAN_PAGES,
    }),
    opts.artistId && fromPage === 1
      ? searchArtistSongTitles(opts.artistId, query, opts.role)
      : Promise.resolve([] as SearchResult[]),
  ]);

  const seen = new Set(lyricHits.collected.map((result) => result.id));
  const collected = [...lyricHits.collected];
  for (const result of catalogHits) {
    if (seen.has(result.id)) continue;
    seen.add(result.id);
    collected.push(result);
  }
  const { scannedPages, nextFromPage } = lyricHits;

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
    results: applyDateAndSort(decorated, opts.startDate, opts.endDate, opts.sort),
    nextFromPage,
    scannedPages,
    query,
    parsed: formatQuery(parsed.ast),
    relaxed,
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
    results: applyDateAndSort(collected, opts.startDate, opts.endDate, opts.sort),
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
