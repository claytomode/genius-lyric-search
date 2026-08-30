"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { LyricCard } from "./LyricCard";
import { selectedLines, linesFromSnippet, type LyricRow } from "@/lib/excerpt";
import { photosFromResult, proxyArt, listArtUrl, type CardPhoto } from "@/lib/cardPhotos";
import { parseQuery } from "@/lib/query";
import { matchQuery } from "@/lib/match";
import type { SearchResult } from "@/lib/types";

type LyricCardModalProps = {
  result: SearchResult;
  query?: string;
  onClose: () => void;
};

function paintMarks(text: string, ranges: { start: number; end: number }[]) {
  const parts: { text: string; hit: boolean }[] = [];
  let cursor = 0;
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  for (const range of sorted) {
    const start = Math.max(0, Math.min(text.length, range.start));
    const end = Math.max(start, Math.min(text.length, range.end));
    if (cursor < start) parts.push({ text: text.slice(cursor, start), hit: false });
    if (end > start) parts.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts.map((part, index) =>
    part.hit ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>,
  );
}

function paintLine(text: string, quote: string[], ast: ReturnType<typeof parseQuery>["ast"] | null) {
  if (ast) {
    const match = matchQuery(ast, text, 0);
    if (match.ok && match.ranges.length) return paintMarks(text, match.ranges);
  }
  if (!quote.length) return text;
  if (quote.includes(text)) return <mark>{text}</mark>;
  for (const piece of quote) {
    if (piece.length >= 2 && piece !== text && text.includes(piece)) {
      const index = text.indexOf(piece);
      return (
        <>
          {text.slice(0, index)}
          <mark>{piece}</mark>
          {text.slice(index + piece.length)}
        </>
      );
    }
  }
  return text;
}

function lineSlice(el: HTMLElement, range: Range): string {
  try {
    if (!range.intersectsNode(el)) return "";
    const contents = document.createRange();
    contents.selectNodeContents(el);
    const clipped = range.cloneRange();
    if (range.compareBoundaryPoints(Range.START_TO_START, contents) < 0) {
      clipped.setStart(contents.startContainer, contents.startOffset);
    }
    if (range.compareBoundaryPoints(Range.END_TO_END, contents) > 0) {
      clipped.setEnd(contents.endContainer, contents.endOffset);
    }
    return clipped.toString().replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

function quoteFromSelection(root: HTMLElement): string[] | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  const lines = Array.from(root.querySelectorAll<HTMLElement>(".card-line-text"))
    .map((el) => lineSlice(el, range))
    .filter((line) => line && !/^\[[^\]]+\]$/.test(line));
  return lines.length ? lines.slice(0, 8) : null;
}

export function LyricCardModal({ result, query, onClose }: LyricCardModalProps) {
  const artist =
    result.featuredArtists.length > 0
      ? `${result.primaryArtist} ft. ${result.featuredArtists.join(", ")}`
      : result.primaryArtist;
  const cardRef = useRef<HTMLDivElement>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const studioRef = useRef<HTMLDivElement>(null);
  const mouseUpRef = useRef<(() => void) | null>(null);
  const [rows, setRows] = useState<LyricRow[]>([]);
  const [quote, setQuote] = useState<string[]>([]);
  const [photos, setPhotos] = useState<CardPhoto[]>(() => photosFromResult(result));
  const [photoId, setPhotoId] = useState(() => photosFromResult(result)[0]?.id ?? "");
  const [size, setSize] = useState<"s" | "m" | "l">("m");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const chosen = photos.find((photo) => photo.id === photoId) ?? photos[0];
  const proxiedArt = proxyArt(chosen?.url ?? null);
  const ast = query ? parseQuery(query).ast : null;

  useEffect(() => {
    const root = studioRef.current;
    const previous = document.activeElement as HTMLElement | null;

    function focusable() {
      return Array.from(
        root?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea") ?? [],
      ).filter((el) => !el.hasAttribute("disabled"));
    }

    focusable()[0]?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      title: result.title,
      artist: result.primaryArtist,
      snippet: result.snippet ?? "",
    });
    if (query) params.set("q", query);
    fetch(`/api/excerpt?${params.toString()}`)
      .then((res) => res.json())
      .then((data: { rows?: LyricRow[]; start?: number; end?: number }) => {
        if (cancelled) return;
        const next = data.rows ?? [];
        setRows(next);
        setQuote(selectedLines(next, data.start ?? 0, data.end ?? 0));
      })
      .catch(() => {
        if (cancelled) return;
        const next = linesFromSnippet(result.snippet ?? "", 12).map((text, id) => ({
          id,
          kind: "line" as const,
          text,
        }));
        setRows(next);
        setQuote(selectedLines(next, 0, Math.min(3, next.length - 1)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [result, query]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/photos?id=${result.id}`)
      .then((res) => res.json())
      .then((data: { photos?: CardPhoto[] }) => {
        if (cancelled || !data.photos?.length) return;
        const next = data.photos;
        setPhotos(next);
        setPhotoId((current) => {
          if (next.some((photo) => photo.id === current)) return current;
          if (current === "artist" || current.startsWith("artist-")) {
            return next.find((photo) => photo.kind === "artist")?.id ?? next[0].id;
          }
          return next[0].id;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [result.id]);

  function captureHighlight() {
    if (!lyricsRef.current) return;
    const lines = quoteFromSelection(lyricsRef.current);
    if (!lines) return;
    setQuote(lines);
    window.getSelection()?.removeAllRanges();
  }

  function startHighlight() {
    if (mouseUpRef.current) window.removeEventListener("mouseup", mouseUpRef.current);
    const onUp = () => {
      captureHighlight();
      window.removeEventListener("mouseup", onUp);
      mouseUpRef.current = null;
    };
    mouseUpRef.current = onUp;
    window.addEventListener("mouseup", onUp);
  }

  useEffect(() => {
    return () => {
      if (mouseUpRef.current) window.removeEventListener("mouseup", mouseUpRef.current);
    };
  }, []);

  async function download() {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const node = cardRef.current;
      const images = Array.from(node.querySelectorAll("img"));
      await Promise.all(
        images.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))),
      );
      const dataUrl = await toPng(node, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: "#000",
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${result.title.replace(/[^\w]+/g, "-").toLowerCase()}-lyric-card.png`;
      link.click();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-overlay" role="dialog" aria-modal="true" aria-labelledby="card-title">
      <button className="card-backdrop" type="button" aria-label="Close" onClick={onClose} />
      <div className="card-studio" ref={studioRef}>
        <div className="card-picker">
          <h2 id="card-title" className="sr-only">
            Lyric card
          </h2>
          <p className="card-picker-hint">Drag to highlight the lyrics you want on the card.</p>
          {loading ? (
            <p className="status" role="status" aria-busy="true">
              Loading lyrics...
            </p>
          ) : null}
          <div
            ref={lyricsRef}
            className="card-lines"
            onMouseDown={startHighlight}
            onTouchEnd={captureHighlight}
          >
            {rows.map((row) =>
              row.kind === "header" ? (
                <div key={row.id} className="card-header-line">
                  {row.text}
                </div>
              ) : (
                <p key={row.id} className="card-line-text">
                  {paintLine(row.text, quote, ast)}
                </p>
              ),
            )}
          </div>
        </div>
        <div className="card-side">
          <div ref={cardRef}>
            <LyricCard
              art={proxiedArt}
              lines={quote}
              title={result.title}
              artist={artist}
              size={size}
            />
          </div>
          {photos.length > 1 ? (
            <div className="card-photos" role="group" aria-label="Card background">
              {photos.map((photo) => {
                const artistCount = photos.filter((item) => item.kind === "artist").length;
                const label =
                  photo.kind === "artist" && artistCount === 1 ? "Artist" : photo.label;
                return (
                  <button
                    key={photo.id}
                    type="button"
                    className="card-photo"
                    aria-pressed={photo.id === chosen?.id}
                    aria-label={label}
                    onClick={() => setPhotoId(photo.id)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={listArtUrl(photo.url) ?? proxyArt(photo.url) ?? ""}
                      alt=""
                      width={72}
                      height={72}
                      loading="lazy"
                      decoding="async"
                    />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="card-actions">
            <label className="filter">
              <span>Type</span>
              <select value={size} onChange={(e) => setSize(e.target.value as "s" | "m" | "l")}>
                <option value="s">Small</option>
                <option value="m">Medium</option>
                <option value="l">Large</option>
              </select>
            </label>
            <button type="button" onClick={download} disabled={busy || quote.length === 0}>
              {busy ? "Saving..." : "Download PNG"}
            </button>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
