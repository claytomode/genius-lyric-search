export type ArtistRole = "both" | "lead" | "featured";
export type SortMode = "views" | "match" | "newest" | "oldest";

export type GeniusArtist = {
  id: number;
  name: string;
  url: string;
  image_url?: string;
  header_image_url?: string;
};

export type GeniusSong = {
  id: number;
  title: string;
  full_title: string;
  title_with_featured: string;
  artist_names: string;
  url: string;
  path: string;
  lyrics_state: string;
  song_art_image_thumbnail_url?: string;
  song_art_image_url?: string;
  header_image_url?: string;
  header_image_thumbnail_url?: string;
  release_date_components: {
    year: number | null;
    month: number | null;
    day: number | null;
  } | null;
  release_date_for_display: string | null;
  stats?: { pageviews?: number; hot?: boolean };
  featured_artists: GeniusArtist[];
  primary_artist: GeniusArtist;
  primary_artists?: GeniusArtist[];
  album?: {
    id: number;
    name: string;
    cover_art_url?: string;
  } | null;
};

export type HighlightRange = { start: number; end: number };

export type GeniusHighlight = {
  property: string;
  value: string;
  snippet?: boolean;
  ranges: HighlightRange[];
};

export type GeniusLyricHit = {
  highlights: GeniusHighlight[];
  matched_words?: number;
  result: GeniusSong;
};

export type MatchKind = "phrase" | "proximity" | "all" | "any" | "fuzzy" | "near";

export type SearchResult = {
  id: number;
  title: string;
  url: string;
  art: string | null;
  artThumb: string | null;
  artistImage: string | null;
  primaryArtist: string;
  primaryArtistId: number;
  featuredArtists: string[];
  role: "lead" | "featured";
  releaseDate: string | null;
  releaseTimestamp: number | null;
  pageviews: number | null;
  snippet: string | null;
  ranges: HighlightRange[];
  score: number;
  matchKind: MatchKind;
  nearMiss: boolean;
};

export type CatalogStreamEvent =
  | { type: "hit"; result: SearchResult }
  | { type: "progress"; page: number; scanned: number }
  | { type: "done"; nextFromPage: number | null };

export type SearchResponse = {
  results: SearchResult[];
  nextFromPage: number | null;
  scannedPages: number;
  query: string;
  parsed: string | null;
  relaxed: boolean;
  continueCatalog?: boolean;
};
