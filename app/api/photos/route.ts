import { NextRequest } from "next/server";
import { songCardPhotos } from "@/lib/genius";
import { cachedJson, jsonError, tooMany } from "@/lib/http";
import { asArtistId } from "@/lib/validate";

export async function GET(request: NextRequest) {
  const limited = tooMany(request, "photos", 40);
  if (limited) return limited;

  const id = asArtistId(request.nextUrl.searchParams.get("id"));
  if (!id) return jsonError("Invalid song id", 400);

  try {
    const photos = await songCardPhotos(id);
    return cachedJson({ photos }, 3600);
  } catch (error) {
    return jsonError("Photo fetch failed", 502, error);
  }
}
