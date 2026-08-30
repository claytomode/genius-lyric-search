import "server-only";

type LrcHit = {
  trackName?: string;
  artistName?: string;
  plainLyrics?: string | null;
};

function same(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

const mem = new Map<string, string | null>();

function keyFor(title: string, artist: string) {
  return `${artist.trim().toLowerCase()}\u0000${title.trim().toLowerCase()}`;
}

export async function lyricsFromLrclib(opts: {
  title: string;
  artist: string;
}): Promise<string | null> {
  const key = keyFor(opts.title, opts.artist);
  if (mem.has(key)) return mem.get(key) ?? null;

  const url = new URL("https://lrclib.net/api/search");
  url.searchParams.set("track_name", opts.title);
  url.searchParams.set("artist_name", opts.artist);

  const res = await fetch(url, {
    headers: { "User-Agent": "LyricSearch/1.0 (https://github.com/claytomode/genius-lyric-search)" },
    redirect: "error",
    signal: AbortSignal.timeout(4000),
    cache: "force-cache",
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    mem.set(key, null);
    return null;
  }
  const hits = (await res.json()) as LrcHit[];
  const exact = hits.find(
    (hit) => hit.plainLyrics && same(hit.trackName ?? "", opts.title) && same(hit.artistName ?? "", opts.artist),
  );
  const lyrics = exact?.plainLyrics ?? hits.find((hit) => hit.plainLyrics)?.plainLyrics ?? null;
  mem.set(key, lyrics);
  return lyrics;
}
