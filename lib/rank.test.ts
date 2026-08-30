import { describe, expect, it } from "vitest";
import { rankResults } from "./rank";
import type { SearchResult } from "./types";

function result(partial: Partial<SearchResult> & { id: number }): SearchResult {
  return {
    title: "Song",
    url: "",
    art: null,
    artThumb: null,
    artistImage: null,
    primaryArtist: "A",
    primaryArtistId: 1,
    featuredArtists: [],
    role: "lead",
    releaseDate: null,
    releaseTimestamp: null,
    pageviews: 0,
    snippet: null,
    ranges: [],
    score: 0,
    matchKind: "any",
    nearMiss: false,
    ...partial,
  };
}

describe("rankResults", () => {
  it("sorts by pageviews", () => {
    const ranked = rankResults(
      [result({ id: 1, pageviews: 10 }), result({ id: 2, pageviews: 50 })],
      undefined,
      undefined,
      "views",
    );
    expect(ranked.map((item) => item.id)).toEqual([2, 1]);
  });
});
