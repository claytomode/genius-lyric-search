"use client";

import { useEffect, useRef, useState } from "react";

export type PickedArtist = { id: number; name: string; image: string | null };

type ArtistPickerProps = {
  value: PickedArtist | null;
  onChange: (artist: PickedArtist | null) => void;
  required?: boolean;
};

export function ArtistPicker({ value, onChange, required = false }: ArtistPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PickedArtist[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim() || value) {
      setResults([]);
      setLoading(false);
      return;
    }

    setResults([]);
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/artists?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { artists?: PickedArtist[] };
        setResults(data.artists ?? []);
        setOpen(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, value]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (value) {
    return (
      <div className="artist-chip">
        {value.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.image} alt="" width={28} height={28} />
        ) : null}
        <span>{value.name}</span>
        <button type="button" aria-label="Clear artist" onClick={() => onChange(null)}>
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="artist-picker" ref={boxRef}>
      <input
        type="search"
        placeholder={required ? "Required" : "Artist"}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => results.length && setOpen(true)}
        autoComplete="off"
        aria-label="Filter by artist"
        aria-required={required || undefined}
        aria-expanded={open}
      />
      {open && (results.length > 0 || loading || query.trim()) ? (
        <ul className="artist-menu">
          {loading && results.length === 0 ? <li className="muted">Searching...</li> : null}
          {!loading && results.length === 0 && query.trim() ? (
            <li className="muted">No matching artists</li>
          ) : null}
          {results.map((artist) => (
            <li key={artist.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(artist);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {artist.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={artist.image} alt="" width={28} height={28} />
                ) : (
                  <span className="artist-fallback">{artist.name.slice(0, 1)}</span>
                )}
                <span>{artist.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
