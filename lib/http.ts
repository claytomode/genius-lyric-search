import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "./rateLimit";

export function jsonError(message: string, status: number, cause?: unknown) {
  if (cause) console.error(message, cause);
  return NextResponse.json({ error: message }, { status });
}

export function tooMany(request: NextRequest, bucket: string, max: number, windowMs = 60_000) {
  if (!rateLimit(clientIp(request.headers), bucket, max, windowMs)) {
    return jsonError("Too many requests", 429);
  }
  return null;
}

export function noStore(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function cachedJson(data: unknown, seconds: number) {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${seconds}, stale-while-revalidate=86400`,
    },
  });
}
