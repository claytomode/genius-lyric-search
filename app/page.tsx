import { HomeSearch } from "@/components/HomeSearch";
import { geniusSearchNeedsArtist } from "@/lib/geniusApi";

export default function Home() {
  const requireArtist = geniusSearchNeedsArtist();

  return (
    <main className="home">
      <h1 className="brand">Lyric Search</h1>
      <p className="tagline">Makes good lyric cards.</p>
      <HomeSearch requireArtist={requireArtist} />
      <footer className="foot">
        Search a line, pick the song, download a PNG. Full songs on{" "}
        <a href="https://genius.com" target="_blank" rel="noopener noreferrer">
          genius.com
        </a>
        . Source on{" "}
        <a href="https://github.com/claytomode/genius-lyric-search" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        .
      </footer>
    </main>
  );
}
