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
});
