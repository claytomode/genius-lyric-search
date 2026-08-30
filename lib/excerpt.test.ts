import { describe, expect, it } from "vitest";
import { parseQuery } from "./query";
import { rowsFromLyrics, selectedLines, snippetForQuery, suggestSelection } from "./excerpt";

describe("excerpt", () => {
  const rows = rowsFromLyrics("[Verse 1]\nHello there\nSober for a week\nI'm fine");

  it("splits headers and lines", () => {
    expect(rows[0]).toMatchObject({ kind: "header", text: "[Verse 1]" });
    expect(rows.filter((row) => row.kind === "line")).toHaveLength(3);
  });

  it("suggests around the snippet", () => {
    const range = suggestSelection(rows, "Sober for a week");
    expect(selectedLines(rows, range.start, range.end).join(" ")).toContain("Sober for a week");
  });

  it("selects the line that actually matches the query", () => {
    const song = rowsFromLyrics("I can't wait in no line\nStarted from the bottom now we're here");
    const range = suggestSelection(song, "I can't wait", (text) => /started from the bottom/i.test(text));
    expect(selectedLines(song, range.start, range.end).join(" ")).toContain("Started from the bottom");
  });
});

describe("snippetForQuery", () => {
  it("does not span the whole song when a word repeats far apart", () => {
    const lyrics = [
      "Popped a perc and I'm geeked in Aroma",
      ...Array.from({ length: 40 }, () => "filler line in the middle"),
      "Popped a perc and I'm geeked in Aroma",
    ].join("\n");
    const cut = snippetForQuery(lyrics, parseQuery("perc").ast);
    expect(cut.snippet.split("\n")).toEqual(["Popped a perc and I'm geeked in Aroma"]);
    expect(cut.snippet.match(/perc/g)).toHaveLength(1);
  });

  it("keeps nearby repeats in one short window", () => {
    const lyrics = [
      "Popped a perc and I'm geeked in Aroma",
      "Count a check, then I pass to my partner",
      "Popped a perc and I'm geeked in Aroma",
    ].join("\n");
    const cut = snippetForQuery(lyrics, parseQuery("perc").ast);
    expect(cut.snippet.split("\n").length).toBeLessThanOrEqual(6);
    expect(cut.snippet.match(/perc/g)).toHaveLength(2);
  });

  it("caps a dense run of matches", () => {
    const lyrics = Array.from({ length: 12 }, () => "Popped a perc and I'm geeked").join("\n");
    const cut = snippetForQuery(lyrics, parseQuery("perc").ast);
    expect(cut.snippet.split("\n").length).toBeLessThanOrEqual(6);
  });

  it("still keeps an exact phrase on the matching line", () => {
    const lyrics = [
      "Started",
      "(Zombie on the track)",
      "Started from the bottom now we're here",
      "Started from the bottom now my whole team here",
    ].join("\n");
    const cut = snippetForQuery(lyrics, parseQuery("started from the bottom").ast);
    expect(cut.snippet).toBe("Started from the bottom now we're here");
  });
});
