import { describe, expect, it } from "vitest";
import { allowedImageType, safeGeniusImageUrl } from "./art";

describe("safeGeniusImageUrl", () => {
  it("accepts https genius image hosts", () => {
    expect(safeGeniusImageUrl("https://images.genius.com/abc.png")?.hostname).toBe(
      "images.genius.com",
    );
  });

  it("rejects http, userinfo, odd ports, and other hosts", () => {
    expect(safeGeniusImageUrl("http://images.genius.com/a.png")).toBeNull();
    expect(safeGeniusImageUrl("https://user:pass@images.genius.com/a.png")).toBeNull();
    expect(safeGeniusImageUrl("https://images.genius.com:8080/a.png")).toBeNull();
    expect(safeGeniusImageUrl("https://evil.com/a.png")).toBeNull();
  });
});

describe("allowedImageType", () => {
  it("allows raster types and rejects svg/html", () => {
    expect(allowedImageType("image/jpeg")).toBe("image/jpeg");
    expect(allowedImageType("image/png; charset=utf-8")).toBe("image/png");
    expect(allowedImageType("image/svg+xml")).toBeNull();
    expect(allowedImageType("text/html")).toBeNull();
  });
});
