import { describe, expect, it } from "vitest";
import { photosFromSong } from "./cardPhotos";
import type { GeniusSong } from "./types";

const artist = {
  id: 1,
  name: "Nettspend",
  url: "https://genius.com/artists/Nettspend",
  image_url: "https://images.genius.com/face.jpg",
};

function song(over: Partial<GeniusSong> = {}): GeniusSong {
  return {
    id: 1,
    title: "sober",
    full_title: "sober by Nettspend",
    title_with_featured: "sober",
    artist_names: "Nettspend",
    url: "https://genius.com/Nettspend-sober-lyrics",
    path: "/Nettspend-sober-lyrics",
    lyrics_state: "complete",
    song_art_image_url: "https://images.genius.com/cover.png",
    featured_artists: [],
    primary_artist: artist,
    release_date_components: null,
    release_date_for_display: null,
    ...over,
  };
}

describe("photosFromSong", () => {
  it("drops gifs and default avatars", () => {
    const photos = photosFromSong(
      song({
        primary_artist: {
          ...artist,
          image_url: "https://assets.genius.com/default_avatar.png",
          header_image_url: "https://images.genius.com/banner.gif",
        },
        album: { id: 1, name: "Album", cover_art_url: "https://images.genius.com/album.png" },
      }),
    );
    expect(photos.some((photo) => photo.kind === "artist")).toBe(false);
    expect(photos.map((photo) => photo.label)).toContain("Album");
  });
});
