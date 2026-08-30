import { describe, expect, it } from "vitest";
import { rowsFromLyrics, selectedLines, suggestSelection } from "./excerpt";

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
