# Genius Lyric Search

Genius's fuzzy search is too fuzzy, and there's no simple way to filter by artist. I built this for me and my friends on their public API. Full songs on [genius.com](https://genius.com).

Search lyric snippets, filter by artist as lead or featured, and make a lyric card. It does not scrape or store full Genius lyrics.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Locally it uses Genius's public website search. No token.

Cloud hosts (including Vercel) get blocked on that API. Create a client at [genius.com/api-clients](https://genius.com/api-clients) and set:

```
GENIUS_API=official
GENIUS_ACCESS_TOKEN=your_client_access_token
```

`GENIUS_API=web` forces the website API even if a token is set.
