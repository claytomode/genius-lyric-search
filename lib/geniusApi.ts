export type GeniusApiMode = "web" | "official";

export type GeniusApiTarget = {
  mode: GeniusApiMode;
  origin: string;
  token: string | null;
};

function geniusApiMode(env: Record<string, string | undefined>): GeniusApiMode {
  const token = env.GENIUS_ACCESS_TOKEN?.trim() || null;
  const raw = env.GENIUS_API?.trim().toLowerCase();
  if (raw === "web" || raw === "website" || raw === "public") return "web";
  if (raw === "official" || raw === "dev" || raw === "developer") return "official";
  return token ? "official" : "web";
}

/** Official API has no lyric search, so production can only scan one artist's catalog. */
export function geniusSearchNeedsArtist(env: Record<string, string | undefined> = process.env) {
  return geniusApiMode(env) === "official";
}

/** Website search (`genius.com/api`) needs no token. Official (`api.genius.com`) needs a client access token. */
export function resolveGeniusApi(
  env: Record<string, string | undefined> = process.env,
): GeniusApiTarget {
  const token = env.GENIUS_ACCESS_TOKEN?.trim() || null;
  const mode = geniusApiMode(env);

  if (mode === "official" && !token) {
    throw new Error("GENIUS_ACCESS_TOKEN is required when GENIUS_API=official");
  }

  return {
    mode,
    origin: mode === "official" ? "https://api.genius.com" : "https://genius.com/api",
    token: mode === "official" ? token : null,
  };
}
