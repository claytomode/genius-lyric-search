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

export function HomeSearch() {
  const [values, setValues] = useState<SearchValues>({
    q: "",
    artist: null,
    role: "both",
    sort: "views",
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
