import { HomeSearch } from "@/components/HomeSearch";

export default function Home() {
  return (
    <main className="home">
      <h1 className="brand">Lyric Search</h1>
      <p className="tagline">Search Engine for Genius Lyrics</p>
      <HomeSearch />
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
