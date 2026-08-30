import { NextRequest, NextResponse } from "next/server";
import { allowedImageType, safeGeniusImageUrl } from "@/lib/art";
import { jsonError, tooMany } from "@/lib/http";

const MAX_BYTES = 5_000_000;

export async function GET(request: NextRequest) {
  const limited = tooMany(request, "art", 180);
  if (limited) return limited;

  const target = safeGeniusImageUrl(request.nextUrl.searchParams.get("u") ?? "");
  if (!target) return jsonError("Invalid image URL", 400);

  try {
    const res = await fetch(target, {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      cache: "force-cache",
      next: { revalidate: 86400 },
    });
    const type = allowedImageType(res.headers.get("content-type"));
    if (!res.ok || !type || !res.body) return jsonError("Image fetch failed", 502);

    const length = Number(res.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_BYTES) return jsonError("Image too large", 413);

    return new NextResponse(res.body, {
      headers: {
        "Content-Type": type,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (error) {
    return jsonError("Image fetch failed", 502, error);
  }
}
