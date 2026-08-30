"use client";

import { useState } from "react";
import { SearchForm, type SearchValues } from "./SearchForm";

const EXAMPLES: { q: string; label: string; artist?: { id: number; name: string } }[] = [
  { q: "started from the bottom", label: "started from the bottom" },
  {
    q: "can't decide",
    label: "Yeat can't decide",
    artist: { id: 1476681, name: "Yeat" },
  },
  {
    q: "she's in love with who I am",
    label: "Drake's verse on SICKO MODE",
    artist: { id: 130, name: "Drake" },
  },
];

type HomeSearchProps = {
  requireArtist?: boolean;
};

export function HomeSearch({ requireArtist = false }: HomeSearchProps) {
  const [values, setValues] = useState<SearchValues>({
    q: "",
    artist: null,
    role: "both",
    sort: "views",
    from: "",
    to: "",
  });

  const examples = EXAMPLES.map((example) =>
    requireArtist && !example.artist
      ? {
          ...example,
          artist: { id: 130, name: "Drake" },
          label: "Drake started from the bottom",
        }
      : example,
  );

  return (
    <>
      <SearchForm values={values} onChange={setValues} requireArtist={requireArtist} />
      {requireArtist ? (
        <p className="limit-note">
          This host can&apos;t search every Genius lyric. Pick an artist and we&apos;ll scan songs
          they&apos;re on as a lead or a feature.
        </p>
      ) : null}
      <p className="examples">
        Try{" "}
        {examples.map((example, index) => (
          <span key={example.label}>
            {index > 0 ? (index === examples.length - 1 ? ", or " : ", ") : null}
            <button
              type="button"
              onClick={() =>
                setValues({
                  ...values,
                  q: example.q,
                  artist: example.artist
                    ? { id: example.artist.id, name: example.artist.name, image: null }
                    : null,
                  role: "both",
                })
              }
            >
              {example.label}
            </button>
          </span>
        ))}
        .
      </p>
    </>
  );
}
