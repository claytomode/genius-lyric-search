"use client";

import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="home">
      <h1 className="brand">Something broke</h1>
      <p className="tagline">Reload, or try the search again.</p>
      <button className="search-btn" type="button" onClick={() => retry()}>
        Try again
      </button>
    </main>
  );
}
