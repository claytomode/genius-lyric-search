import { NextRequest, NextResponse } from "next/server";

const ALLOWED = new Set(["images.genius.com", "images.rapgenius.com"]);

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("u") ?? "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }
  if (!ALLOWED.has(target.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  const res = await fetch(target, { next: { revalidate: 86400 } });
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "Image fetch failed" }, { status: 502 });
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
