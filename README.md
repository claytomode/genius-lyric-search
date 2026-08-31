# Lyric Cards

Live: [genius-lyric-search.vercel.app](https://genius-lyric-search.vercel.app/)

Find a line you remember, then export a card. Genius's search is too fuzzy and has no artist filter, so this exists. Full songs on [genius.com](https://genius.com).

Search is how you get to the line. The point is the PNG. It does not scrape or store full Genius lyrics.

## Limits

There is no free API I could find that searches **inside** lyrics. Licensed ones (Musixmatch, etc.) do, and they cost money. Everything free is a lookup: you already know the song, then you fetch the words.

So this app splits the job:

- **Genius** is the catalog — which songs exist, who's credited, art, views, the Genius page.
- **[lrclib](https://lrclib.net)** is the words. Given a title + artist, it returns lyrics if it has them. Its own search is title/artist/album, not lyric text.

**Locally**, Genius's website JSON (`genius.com/api`) can search lyrics. No token. Cloud IPs (Vercel included) get blocked, so production uses the documented developer API (`api.genius.com`). That API has one search endpoint: song **metadata** (title/credits), not lyrics, and no artist-name search.

**On Vercel** you pick an artist. We page their Genius discography, ask lrclib for each song, and grep for the line. That's why it's slower than Genius.com and why an artist is required there. It does not scrape or store full Genius lyrics.

If lrclib doesn't have the song, the card may be thin. Result-list covers are small Genius CDN thumbs; the downloadable card still proxies the full image so the PNG export isn't cross-origin.

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
