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
        Genius&apos;s native search is too fuzzy and has no artist filter, so I made
        this. Full songs on{" "}
        <a href="https://genius.com" target="_blank" rel="noopener noreferrer">
          genius.com
        </a>
        .
      </footer>
    </main>
  );
}
