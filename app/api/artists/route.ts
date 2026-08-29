import { NextRequest } from "next/server";
import { searchArtists } from "@/lib/genius";
import { cachedJson, jsonError, tooMany } from "@/lib/http";
import { clip } from "@/lib/validate";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const limited = tooMany(request, "artists", 30);
  if (limited) return limited;

  const q = clip(request.nextUrl.searchParams.get("q")?.trim() ?? "", 80);
  if (q.length < 1) return cachedJson({ artists: [] }, 60);

  try {
    const artists = await searchArtists(q);
    return cachedJson(
      {
        artists: artists.map((artist) => ({
          id: artist.id,
          name: artist.name,
          image: artist.image_url || artist.header_image_url || null,
        })),
      },
      300,
    );
  } catch (error) {
    return jsonError("Artist search failed", 502, error);
  }
}
