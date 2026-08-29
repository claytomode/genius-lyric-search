import type { GeniusArtist, GeniusSong, SearchResult } from "./types";

export type CardPhoto = {
  id: string;
  kind: "album" | "artist";
  label: string;
  url: string;
};

function usableImage(url?: string | null): url is string {
  if (!url) return false;
  if (/\.gif(\?|$)/i.test(url)) return false;
  if (/default_avatar|default_cover|empty_photo|missing_image/i.test(url)) return false;
  return true;
}

function addPhoto(photos: CardPhoto[], photo: Omit<CardPhoto, "url"> & { url?: string | null }) {
  if (!usableImage(photo.url)) return;
  if (photos.some((existing) => existing.url === photo.url)) return;
  photos.push({ id: photo.id, kind: photo.kind, label: photo.label, url: photo.url });
}

function artistList(song: GeniusSong): GeniusArtist[] {
  const primaries = song.primary_artists?.length
    ? song.primary_artists
    : song.primary_artist
      ? [song.primary_artist]
      : [];
  return [...primaries, ...(song.featured_artists ?? [])];
}

export function photosFromSong(song: GeniusSong): CardPhoto[] {
  const photos: CardPhoto[] = [];
  const albumCover = song.album?.cover_art_url;
  const songArt = song.song_art_image_url || song.header_image_url;

  if (usableImage(albumCover) && usableImage(songArt) && albumCover !== songArt) {
    addPhoto(photos, { id: "cover", kind: "album", label: "Cover", url: songArt });
    addPhoto(photos, { id: "album", kind: "album", label: "Album", url: albumCover });
  } else {
    addPhoto(photos, { id: "album", kind: "album", label: "Album", url: albumCover ?? songArt });
  }

  for (const artist of artistList(song)) {
    addPhoto(photos, {
      id: `artist-${artist.id}`,
      kind: "artist",
      label: artist.name,
      url: artist.image_url ?? "",
    });
  }

  return photos;
}

export function photosFromResult(result: SearchResult): CardPhoto[] {
  const photos: CardPhoto[] = [];
  if (result.art) {
    photos.push({ id: "album", kind: "album", label: "Album", url: result.art });
  }
  if (result.artistImage) {
    addPhoto(photos, {
      id: "artist",
      kind: "artist",
      label: result.primaryArtist,
      url: result.artistImage,
    });
  }
  return photos;
}

export function proxyArt(url: string | null) {
  return url ? `/api/art?u=${encodeURIComponent(url)}` : null;
}
