import type { GeniusArtist, GeniusSong } from "./types";

function foldArtist(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function artistQueryScore(name: string, q: string) {
  const hay = foldArtist(name);
  const needle = foldArtist(q);
  if (!hay || !needle) return 0;
  if (hay === needle) return 4;
  if (hay.startsWith(needle) || (needle.startsWith(hay) && hay.length >= 3)) return 3;
  if (hay.includes(needle)) return 2;
  return 0;
}

function artistsOnSong(song: GeniusSong): GeniusArtist[] {
  return [
    song.primary_artist,
    ...(song.primary_artists ?? []),
    ...(song.featured_artists ?? []),
  ].filter((artist): artist is GeniusArtist => Boolean(artist?.id));
}

/** Official Genius search is songs-only. Pull credited artists and keep the ones that match the query. */
export function artistsFromSongHits(hits: { result?: GeniusSong }[], q: string): GeniusArtist[] {
  const best = new Map<number, { artist: GeniusArtist; score: number }>();
  for (const hit of hits) {
    const song = hit.result;
    if (!song) continue;
    for (const artist of artistsOnSong(song)) {
      const score = artistQueryScore(artist.name, q);
      if (score <= 0) continue;
      const prev = best.get(artist.id);
      if (!prev || score > prev.score) best.set(artist.id, { artist, score });
    }
  }

  return [...best.values()]
    .sort((a, b) => b.score - a.score || a.artist.name.localeCompare(b.artist.name))
    .map((item) => item.artist);
}
