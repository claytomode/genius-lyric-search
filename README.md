# Genius Lyric Search

Live: [genius-lyric-search.vercel.app](https://genius-lyric-search.vercel.app/)

Genius's fuzzy search is too fuzzy, and there's no simple way to filter by artist. I built this for me and my friends on their public API. Full songs on [genius.com](https://genius.com).

Search lyric snippets, filter by artist as lead or featured, and make a lyric card. It does not scrape or store full Genius lyrics.

## Limits

If we owned the Genius catalog, this would be an elasticsearch index. We don't, so we sit on top of Genius's public search plus [lrclib](https://lrclib.net) excerpts. This is not ideal.

Genius has no artist filter on lyric search. Picking an artist means: search as usual, keep songs they're on, and if that comes up empty, scan their catalog against lrclib. That fallback can be slow the first time.

Cloud hosts (Vercel included) often can't use Genius's public website search. The official API has no lyric-search endpoint, so production scans one artist's catalog (lead or featured) against lrclib. An artist is required there. Locally the website search usually works with no token and no artist.

Cards and longer excerpts come from lrclib, not Genius. If lrclib doesn't have the song, the card may be thin. Result-list covers are small Genius CDN thumbs; the downloadable card still proxies the full image so the PNG export isn't cross-origin.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Locally it uses Genius's public website search. No token.

Cloud hosts get blocked on that API. Create a client at [genius.com/api-clients](https://genius.com/api-clients) and set:

```
GENIUS_API=official
GENIUS_ACCESS_TOKEN=your_client_access_token
```

`GENIUS_API=web` forces the website API even if a token is set. That also turns off the artist requirement.
