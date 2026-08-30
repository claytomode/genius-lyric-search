import { HomeSearch } from "@/components/HomeSearch";
import { geniusSearchNeedsArtist } from "@/lib/geniusApi";

export default function Home() {
  const requireArtist = geniusSearchNeedsArtist();

  return (
    <main className="home">
      <h1 className="brand">Lyric Search</h1>
      <p className="tagline">Search Engine for Genius Lyrics</p>
      <HomeSearch requireArtist={requireArtist} />
      <footer className="foot">
        {requireArtist ? (
          <>
            This server can&apos;t search the whole Genius catalog for a line, so an artist is
            required. Credit defaults to lead or featured. Full songs on{" "}
            <a href="https://genius.com" target="_blank" rel="noopener noreferrer">
              genius.com
            </a>
            .
          </>
        ) : (
          <>
            Genius&apos;s native search is too fuzzy and has no artist filter, so I made
            this. Full songs on{" "}
            <a href="https://genius.com" target="_blank" rel="noopener noreferrer">
              genius.com
            </a>
            .
          </>
        )}
      </footer>
    </main>
  );
}
