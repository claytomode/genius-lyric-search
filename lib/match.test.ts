import { describe, expect, it } from "vitest";
import { parseQuery } from "./query";
import { matchQuery } from "./match";

describe("matchQuery", () => {
  const snippet = "changed\nSober for a week, sober for a day\nSo-sober for a week";

  it("highlights the lyric line, not a title token", () => {
    const parsed = parseQuery("Sober for a week");
    const match = matchQuery(parsed.ast, snippet);
    expect(match.ok).toBe(true);
    const bits = match.ranges.map((range) => snippet.slice(range.start, range.end));
    expect(bits.join(" ")).toBe("Sober for a week");
  });

  it("requires every implicit term", () => {
    const parsed = parseQuery("Sober for a week");
    expect(matchQuery(parsed.ast, "I am sober today").ok).toBe(false);
  });

  it("matches an exact phrase", () => {
    const parsed = parseQuery('"Sober for a week"');
    expect(matchQuery(parsed.ast, snippet).ok).toBe(true);
  });

  it("picks the tight consecutive line, not an earlier leftover word", () => {
    const lyrics = [
      "Started",
      "(Zombie on the track)",
      "Started from the bottom now we're here",
      "Started from the bottom now my whole team here",
    ].join("\n");
    const parsed = parseQuery("started from the bottom");
    const match = matchQuery(parsed.ast, lyrics);
    expect(match.ok).toBe(true);
    const painted = lyrics.slice(match.ranges[0].start, match.ranges[match.ranges.length - 1].end);
    expect(painted).toBe("Started from the bottom");
  });

  it("does not match terms scattered across the song", () => {
    const parsed = parseQuery("can't decide");
    const lyrics = "I can't wait in no line\n\nI switch the side, couldn't wait\nlater I decide nothing";
    expect(matchQuery(parsed.ast, lyrics).ok).toBe(false);
  });

  it("ignores case and punctuation", () => {
    const parsed = parseQuery("can't decide");
    const line = "I just Can't decide, tonight";
    const match = matchQuery(parsed.ast, line);
    expect(match.ok).toBe(true);
    const bits = match.ranges.map((range) => line.slice(range.start, range.end));
    expect(bits.join(" ")).toBe("Can't decide");
  });

  it("does not treat couldn't as can't", () => {
    const parsed = parseQuery("can't decide");
    expect(matchQuery(parsed.ast, "couldn't decide on the wrap").ok).toBe(false);
  });
});
