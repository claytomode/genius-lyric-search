import { Suspense } from "react";
import Link from "next/link";
import { ResultsView } from "@/components/ResultsView";
import { geniusSearchNeedsArtist } from "@/lib/geniusApi";

export default function SearchPage() {
  const requireArtist = geniusSearchNeedsArtist();

  return (
    <main className="shell">
      <header className="site-header">
        <Link href="/">Lyric Cards</Link>
        <a
          className="site-source"
          href="https://github.com/claytomode/genius-lyric-search"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </header>
      <Suspense fallback={<p className="status">Loading...</p>}>
        <ResultsView requireArtist={requireArtist} />
      </Suspense>
    </main>
  );
}
