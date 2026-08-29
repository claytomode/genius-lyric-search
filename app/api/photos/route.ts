import { NextRequest, NextResponse } from "next/server";
import { songCardPhotos } from "@/lib/genius";

export async function GET(request: NextRequest) {
  const id = Number(request.nextUrl.searchParams.get("id") ?? "");
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid song id" }, { status: 400 });
  }

  try {
    const photos = await songCardPhotos(id);
    return NextResponse.json({ photos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
