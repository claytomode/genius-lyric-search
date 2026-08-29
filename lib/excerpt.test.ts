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
});
