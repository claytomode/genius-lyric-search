import { describe, expect, it } from "vitest";
import { geniusQueries, parseQuery } from "./query";

describe("parseQuery", () => {
  it("treats a plain line as implicit AND", () => {
    const parsed = parseQuery("Sober for a week");
    expect(parsed.explicit).toBe(false);
    expect(parsed.ast.type).toBe("and");
  });

  it("caps fuzz at 2", () => {
    const parsed = parseQuery("sober~99");
    expect(parsed.ast.type).toBe("term");
    if (parsed.ast.type === "term") expect(parsed.ast.fuzz).toBe(2);
  });

  it("parses quotes, OR, and NOT", () => {
    const parsed = parseQuery('"sober for a week" OR NOT drunk');
    expect(parsed.explicit).toBe(true);
    expect(geniusQueries(parsed.ast).length).toBeLessThanOrEqual(4);
  });
});
