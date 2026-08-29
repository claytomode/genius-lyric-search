import { HighlightedSnippet } from "./HighlightedSnippet";
import { matchKindLabel } from "@/lib/match";
import type { SearchResult } from "@/lib/types";

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K views`;
  return `${n} views`;
}

export function ResultCard({
  result,
  artistName,
  onCard,
}: {
  result: SearchResult;
  artistName?: string;
  onCard?: () => void;
}) {
  const featuredOn = result.role === "featured" ? result.primaryArtist : null;
  const others = result.featuredArtists.filter((name) => name !== artistName);

  return (
    <article className="result">
      {result.art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="art" src={result.art} alt="" />
      ) : (
        <div className="art placeholder" />
      )}
      <div className="result-body">
        <a className="title" href={result.url} target="_blank" rel="noreferrer">
          {result.title}
        </a>
        <p className="meta">
          {featuredOn ? (
            <>
              <span className="badge feat">Featured on</span> {featuredOn}
            </>
          ) : (
            <>
              <span className="badge lead">By</span> {result.primaryArtist}
              {others.length ? ` · ft. ${others.join(", ")}` : null}
            </>
          )}
          {result.releaseDate ? ` · ${result.releaseDate}` : null}
          {result.pageviews ? ` · ${formatViews(result.pageviews)}` : null}
          {result.nearMiss ? ` · ${matchKindLabel(result.matchKind)}` : null}
        </p>
        {result.snippet ? (
          <HighlightedSnippet text={result.snippet} ranges={result.ranges} />
        ) : null}
        {result.snippet && onCard ? (
          <button className="card-btn" type="button" onClick={onCard}>
            Lyric card
          </button>
        ) : null}
      </div>
    </article>
  );
}
