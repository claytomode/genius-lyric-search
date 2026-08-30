import { describe, expect, it } from "vitest";
import { geniusSearchNeedsArtist, resolveGeniusApi } from "./geniusApi";

describe("resolveGeniusApi", () => {
  it("defaults to the website API with no token", () => {
    expect(resolveGeniusApi({})).toEqual({
      mode: "web",
      origin: "https://genius.com/api",
      token: null,
    });
  });

  it("uses the official API when a token is set", () => {
    expect(resolveGeniusApi({ GENIUS_ACCESS_TOKEN: "abc" })).toEqual({
      mode: "official",
      origin: "https://api.genius.com",
      token: "abc",
    });
  });

  it("lets GENIUS_API=web keep the website API even if a token exists", () => {
    expect(
      resolveGeniusApi({ GENIUS_API: "web", GENIUS_ACCESS_TOKEN: "abc" }).mode,
    ).toBe("web");
  });

  it("requires a token for GENIUS_API=official", () => {
    expect(() => resolveGeniusApi({ GENIUS_API: "official" })).toThrow(/GENIUS_ACCESS_TOKEN/);
  });
});

describe("geniusSearchNeedsArtist", () => {
  it("is off for the website API", () => {
    expect(geniusSearchNeedsArtist({})).toBe(false);
    expect(geniusSearchNeedsArtist({ GENIUS_API: "web", GENIUS_ACCESS_TOKEN: "abc" })).toBe(false);
  });

  it("is on for the official API", () => {
    expect(geniusSearchNeedsArtist({ GENIUS_ACCESS_TOKEN: "abc" })).toBe(true);
    expect(geniusSearchNeedsArtist({ GENIUS_API: "official" })).toBe(true);
  });
});
