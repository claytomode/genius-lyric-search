import { HighlightedSnippet } from "./HighlightedSnippet";
import { matchKindLabel } from "@/lib/match";
import { listArtUrl, proxyArt } from "@/lib/cardPhotos";
import type { SearchResult } from "@/lib/types";

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K views`;
  return `${n} views`;
}

function geniusHref(url: string) {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "https:" &&
      (parsed.hostname === "genius.com" || parsed.hostname.endsWith(".genius.com"))
    ) {
      return url;
    }
  } catch {
    return null;
  }
  return null;
}

export function ResultCard({
  result,
  artistName,
  onCard,
  priority = false,
}: {
  result: SearchResult;
  artistName?: string;
  onCard?: () => void;
  priority?: boolean;
}) {
  const featuredOn = result.role === "featured" ? result.primaryArtist : null;
  const others = result.featuredArtists.filter((name) => name !== artistName);
  const href = geniusHref(result.url);
  const art = listArtUrl(result.artThumb || result.art) ?? proxyArt(result.artThumb || result.art);

  return (
    <article className="result">
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="art"
          src={art}
          alt=""
          width={56}
          height={56}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
        />
      ) : (
        <div className="art placeholder" />
      )}
      <div className="result-body">
        {href ? (
          <a className="title" href={href} target="_blank" rel="noopener noreferrer">
            {result.title}
          </a>
        ) : (
          <span className="title">{result.title}</span>
        )}
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
        {onCard ? (
          <button className="card-btn" type="button" onClick={onCard}>
            Lyric card
          </button>
        ) : null}
      </div>
    </article>
  );
}
