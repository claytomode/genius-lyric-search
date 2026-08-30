"use client";

import { useEffect, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { LyricCard } from "./LyricCard";
import { linesFromSnippet, type LyricRow } from "@/lib/excerpt";
import { photosFromResult, proxyArt, listArtUrl, type CardPhoto } from "@/lib/cardPhotos";
import { prefetchExcerpt, prefetchPhotos } from "@/lib/prefetch";
import type { SearchResult } from "@/lib/types";

type LyricCardModalProps = {
  result: SearchResult;
  query?: string;
  onClose: () => void;
};

type PickedLine = { id: number; fragment: string };

function paintLine(row: LyricRow, picked: PickedLine[]) {
  const hit = picked.find((item) => item.id === row.id);
  if (!hit) return row.text;
  if (!hit.fragment || hit.fragment === row.text) return <mark>{row.text}</mark>;
  const index = row.text.indexOf(hit.fragment);
  if (index < 0) return <mark>{row.text}</mark>;
  return (
    <>
      {row.text.slice(0, index)}
      <mark>{hit.fragment}</mark>
      {row.text.slice(index + hit.fragment.length)}
    </>
  );
}

function pickFromRange(rows: LyricRow[], start: number, end: number): PickedLine[] {
  return rows
    .filter((row) => row.kind === "line" && row.id >= Math.min(start, end) && row.id <= Math.max(start, end))
    .slice(0, 8)
    .map((row) => ({ id: row.id, fragment: row.text }));
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

function quoteFromSelection(root: HTMLElement): PickedLine[] | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  const lines = Array.from(root.querySelectorAll<HTMLElement>(".card-line-text"))
    .map((el) => {
      const fragment = lineSlice(el, range);
      const id = Number(el.dataset.id);
      return { id, fragment };
    })
    .filter((line) => Number.isInteger(line.id) && line.fragment && !/^\[[^\]]+\]$/.test(line.fragment));
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
  const snippetRows = linesFromSnippet(result.snippet ?? "", 12).map((text, id) => ({
    id,
    kind: "line" as const,
    text,
  }));
  const [rows, setRows] = useState<LyricRow[]>(snippetRows);
  const [picked, setPicked] = useState<PickedLine[]>(() =>
    pickFromRange(snippetRows, 0, Math.min(3, Math.max(0, snippetRows.length - 1))),
  );
  const [photos, setPhotos] = useState<CardPhoto[]>(() => photosFromResult(result));
  const [photoId, setPhotoId] = useState(() => photosFromResult(result)[0]?.id ?? "");
  const [size, setSize] = useState<"s" | "m" | "l">("m");
  const [busy, setBusy] = useState<"save" | "copy" | false>(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const chosen = photos.find((photo) => photo.id === photoId) ?? photos[0];
  const proxiedArt = proxyArt(chosen?.url ?? null);
  const quote = picked.map((item) => item.fragment);

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
    prefetchExcerpt(result, query)
      .then((data) => {
        if (cancelled || !data?.rows?.length) return;
        setRows(data.rows);
        setPicked(pickFromRange(data.rows, data.start ?? 0, data.end ?? 0));
      })
      .catch(() => {
        if (cancelled) return;
        const next = linesFromSnippet(result.snippet ?? "", 12).map((text, id) => ({
          id,
          kind: "line" as const,
          text,
        }));
        setRows(next);
        setPicked(pickFromRange(next, 0, Math.min(3, next.length - 1)));
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
    prefetchPhotos(result.id)
      .then((next) => {
        if (cancelled || !next.length) return;
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
    setPicked(lines);
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

  async function renderCard() {
    if (!cardRef.current) return null;
    const node = cardRef.current;
    const images = Array.from(node.querySelectorAll("img"));
    await Promise.all(
      images.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))),
    );
    return toBlob(node, {
      pixelRatio: 3,
      cacheBust: true,
      backgroundColor: "#000",
    });
  }

  async function download() {
    setBusy("save");
    try {
      const blob = await renderCard();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${result.title.replace(/[^\w]+/g, "-").toLowerCase()}-lyric-card.png`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  async function copyCard() {
    if (!quote.length) return;
    setBusy("copy");
    try {
      const blob = await renderCard();
      if (blob && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
      } else {
        await navigator.clipboard.writeText(quote.join("\n"));
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      try {
        await navigator.clipboard.writeText(quote.join("\n"));
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      } catch {
        setCopied(false);
      }
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
          {loading && rows.length === 0 ? (
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
                <p key={row.id} className="card-line-text" data-id={row.id}>
                  {paintLine(row, picked)}
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
              <span>Text</span>
              <select value={size} onChange={(e) => setSize(e.target.value as "s" | "m" | "l")}>
                <option value="s">Small</option>
                <option value="m">Medium</option>
                <option value="l">Large</option>
              </select>
            </label>
            <button type="button" onClick={copyCard} disabled={busy !== false || quote.length === 0}>
              {copied ? "Copied" : busy === "copy" ? "Copying..." : "Copy"}
            </button>
            <button type="button" onClick={download} disabled={busy !== false || quote.length === 0}>
              {busy === "save" ? "Saving..." : "Download PNG"}
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
