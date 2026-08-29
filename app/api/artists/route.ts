import { NextRequest, NextResponse } from "next/server";
import { searchArtists } from "@/lib/genius";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ artists: [] });
  }

  try {
    const artists = await searchArtists(q);
    return NextResponse.json({
      artists: artists.map((artist) => ({
        id: artist.id,
        name: artist.name,
        image: artist.image_url || artist.header_image_url || null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Artist search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
