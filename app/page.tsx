import { HomeSearch } from "@/components/HomeSearch";

export default function Home() {
  return (
    <main className="home">
      <h1 className="brand">Lyric Search</h1>
      <p className="tagline">Search Engine for Genius Lyrics</p>
      <HomeSearch />
      <p className="foot">
        Snippets from Genius search. Open a song to read the full lyrics.{" "}
        <a href="https://genius.com" target="_blank" rel="noreferrer">
          genius.com
        </a>
      </p>
    </main>
  );
}
