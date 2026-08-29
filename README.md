# Genius Lyric Search

A small lyric search for me and my friends, because Genius’s own search is bad at this.

Genius will look up a line you remember, but there is **no artist filter**. Type an artist name into the box and it searches for that word *in the lyrics*. Features are also filed under the lead artist, so you cannot ask “Drake’s verse on this Travis song” without drowning in tracklists.

This app searches Genius lyric snippets, then lets you filter by artist as **lead or featured**. Open a result for the full lyrics on Genius. You can also make a Genius-style lyric card (highlight the lines, pick album or artist art, download a PNG).

It does **not** scrape or store full Genius lyrics. Search snippets come from Genius’s public search API. Card excerpts come from [lrclib](https://lrclib.net/) when a match exists. No Genius API token.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Search tips

- A line you remember, then optionally pick an artist.
- **Lead or featured** / **By them** / **Featured on** — features are the point.
- Quotes, `AND` / `OR` / `NOT`, and `term~1` fuzzy matching work if you want them.

## Lyric cards

On a result with a snippet, **Lyric card**. Highlight the lines on the left (Genius-yellow on the lyrics, white type on the cover). Pick album/cover vs artist photo, then download.
