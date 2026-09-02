# Lyric Search

Live: [genius-lyric-search.vercel.app](https://genius-lyric-search.vercel.app/)

Search a line you remember and export a good lyric card. Genius's native search is too fuzzy and has no artist filter, so this exists. Full songs stay on [genius.com](https://genius.com) and [lrclib](https://lrclib.net). This does not scrape or store Genius lyrics.

There is no free API that searches **inside** lyrics. Paid ones exist. [lrclib](https://lrclib.net) only looks up words if you already know the song. So Genius is the catalog (songs, credits, art); lrclib is the text.

Locally, Genius's website API can search lyrics (no token). Cloud IPs block that, so Vercel uses the official API — metadata search only. You pick an artist, we grep their discography. That's why production is slower and needs an artist.

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000). For Vercel, a client from [genius.com/api-clients](https://genius.com/api-clients):

```
GENIUS_API=official
GENIUS_ACCESS_TOKEN=your_client_access_token
```

`GENIUS_API=web` forces the website API even with a token, and drops the artist requirement.
