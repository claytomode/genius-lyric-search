"use client";

import { useState } from "react";
import { SearchForm, type SearchValues } from "./SearchForm";

const EXAMPLES: { q: string; label: string; artist?: { id: number; name: string } }[] = [
  { q: "started from the bottom", label: "started from the bottom" },
  { q: "hello from the other side", label: "hello from the other side" },
  {
    q: "she's in love with who I am",
    label: "Drake's verse on SICKO MODE",
    artist: { id: 130, name: "Drake" },
  },
];

export function HomeSearch() {
  const [values, setValues] = useState<SearchValues>({
    q: "",
    artist: null,
    role: "both",
    sort: "match",
    from: "",
    to: "",
  });

  return (
    <>
      <SearchForm values={values} onChange={setValues} />
      <p className="examples">
        Try{" "}
        {EXAMPLES.map((example, index) => (
          <span key={example.label}>
            {index > 0 ? (index === EXAMPLES.length - 1 ? ", or " : ", ") : null}
            <button
              type="button"
              onClick={() =>
                setValues({
                  ...values,
                  q: example.q,
                  artist: example.artist
                    ? { id: example.artist.id, name: example.artist.name, image: null }
                    : values.artist,
                  role: example.artist ? "both" : values.role,
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
