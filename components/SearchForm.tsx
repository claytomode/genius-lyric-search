"use client";

import { FormEvent, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArtistPicker, type PickedArtist } from "./ArtistPicker";
import type { ArtistRole, SortMode } from "@/lib/types";

export type SearchValues = {
  q: string;
  artist: PickedArtist | null;
  role: ArtistRole;
  sort: SortMode;
  from: string;
  to: string;
};

type SearchFormProps = {
  values: SearchValues;
  onChange: (values: SearchValues) => void;
  compact?: boolean;
};

export function SearchForm({ values, onChange, compact }: SearchFormProps) {
  const router = useRouter();

  const canSubmit = useMemo(
    () => values.q.trim().length > 0 || Boolean(values.artist),
    [values.q, values.artist],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    const params = new URLSearchParams();
    if (values.q.trim()) params.set("q", values.q.trim());
    if (values.artist) {
      params.set("artist", String(values.artist.id));
      params.set("name", values.artist.name);
    }
    if (values.role !== "both") params.set("role", values.role);
    if (values.sort !== "views") params.set("sort", values.sort);
    if (values.from) params.set("from", values.from);
    if (values.to) params.set("to", values.to);
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form className={compact ? "search-form compact" : "search-form"} onSubmit={submit}>
      <div className="search-row">
        <input
          className="query-input"
          name="q"
          type="search"
          placeholder="A line you remember..."
          value={values.q}
          onChange={(e) => onChange({ ...values, q: e.target.value })}
          aria-label="Lyric line"
        />
        <button className="search-btn" type="submit" disabled={!canSubmit}>
          Search
        </button>
      </div>

      <div className="filter-row">
        <div className="filter">
          <span>Artist</span>
          <ArtistPicker
            value={values.artist}
            onChange={(artist) => onChange({ ...values, artist })}
          />
        </div>
        <label className="filter">
          <span>Credit</span>
          <select
            value={values.role}
            disabled={!values.artist}
            onChange={(e) => onChange({ ...values, role: e.target.value as ArtistRole })}
          >
            <option value="both">Lead or featured</option>
            <option value="lead">By them</option>
            <option value="featured">Featured on</option>
          </select>
        </label>
        <label className="filter">
          <span>From</span>
          <input
            type="date"
            value={values.from}
            onChange={(e) => onChange({ ...values, from: e.target.value })}
          />
        </label>
        <label className="filter">
          <span>To</span>
          <input
            type="date"
            value={values.to}
            onChange={(e) => onChange({ ...values, to: e.target.value })}
          />
        </label>
        <fieldset className="sort">
          <legend className="sr-only">Sort</legend>
          {(
            [
              ["views", "Most views"],
              ["match", "Best match"],
              ["newest", "Newest"],
              ["oldest", "Oldest"],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="sort"
                value={value}
                checked={values.sort === value}
                onChange={() => onChange({ ...values, sort: value })}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </div>
    </form>
  );
}
