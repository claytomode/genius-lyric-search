import { describe, expect, it } from "vitest";
import { artistQueryScore, artistsFromSongHits } from "./artists";
import type { GeniusArtist, GeniusSong } from "./types";

function artist(partial: Partial<GeniusArtist> & { id: number; name: string }): GeniusArtist {
  return { url: "", ...partial };
}

function song(partial: Partial<GeniusSong> & { primary_artist: GeniusArtist }): GeniusSong {
  return {
    id: 1,
    title: "Song",
    full_title: "Song",
    title_with_featured: "Song",
    artist_names: partial.primary_artist.name,
    url: "",
    path: "",
    lyrics_state: "complete",
    release_date_components: null,
    release_date_for_display: null,
    featured_artists: [],
    ...partial,
  };
}

describe("artistQueryScore", () => {
  it("treats Quavo as an exact match for quavo", () => {
    expect(artistQueryScore("Quavo", "quavo")).toBeGreaterThan(artistQueryScore("Drake", "quavo"));
  });
});

describe("artistsFromSongHits", () => {
  it("prefers a featured artist whose name matches the query", () => {
    const quavo = artist({ id: 21615, name: "Quavo" });
    const khaled = artist({ id: 263, name: "DJ Khaled" });
    const hits = [
      { result: song({ primary_artist: khaled, featured_artists: [quavo] }) },
      { result: song({ primary_artist: artist({ id: 130, name: "Drake" }) }) },
    ];
    expect(artistsFromSongHits(hits, "quavo").map((item) => item.name)).toEqual(["Quavo"]);
  });

  it("keeps a matching lead artist ahead of a looser name match", () => {
    const hits = [
      {
        result: song({
          primary_artist: artist({ id: 1, name: "Quavo" }),
          featured_artists: [artist({ id: 2, name: "Quavo Huncho" })],
        }),
      },
    ];
    expect(artistsFromSongHits(hits, "quavo").map((item) => item.name)).toEqual([
      "Quavo",
      "Quavo Huncho",
    ]);
  });
});
