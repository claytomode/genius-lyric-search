import { NextRequest } from "next/server";
import { streamArtistCatalog } from "@/lib/genius";
import { jsonError, tooMany } from "@/lib/http";
import { asArtistId, asDate, asIdList, clampPage, clip } from "@/lib/validate";
import type { ArtistRole, CatalogStreamEvent, SortMode } from "@/lib/types";

export const maxDuration = 30;
export const runtime = "nodejs";

function asRole(value: string | null): ArtistRole {
  if (value === "lead" || value === "featured" || value === "both") return value;
  return "both";
}

function asSort(value: string | null): SortMode {
  if (value === "newest" || value === "oldest" || value === "match" || value === "views") return value;
  return "views";
}

export async function GET(request: NextRequest) {
  const limited = tooMany(request, "catalog", 10);
  if (limited) return limited;

  const { searchParams } = request.nextUrl;
  const q = clip(searchParams.get("q") ?? "", 200);
  const artistId = asArtistId(searchParams.get("artist"));
  const role = asRole(searchParams.get("role"));
  const sort = asSort(searchParams.get("sort"));
  const startDate = asDate(searchParams.get("from"));
  const endDate = asDate(searchParams.get("to"));
  const fromPage = clampPage(searchParams.get("fromPage"));
  const skipIds = asIdList(searchParams.get("skip"));

  if (!q.trim() || !artistId) {
    return jsonError("Pick an artist and a line.", 400);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: CatalogStreamEvent) => {
        if (request.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          return;
        }
      };
      try {
        await streamArtistCatalog({
          q,
          artistId,
          role,
          sort,
          startDate,
          endDate,
          fromPage,
          skipIds,
          onEvent: send,
          signal: request.signal,
        });
      } catch (error) {
        console.error("Catalog stream failed", error);
        send({ type: "done", nextFromPage: fromPage });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
