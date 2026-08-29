export type GeniusApiMode = "web" | "official";

export type GeniusApiTarget = {
  mode: GeniusApiMode;
  origin: string;
  token: string | null;
};

/** Website search (`genius.com/api`) needs no token. Official (`api.genius.com`) needs a client access token. */
export function resolveGeniusApi(
  env: Record<string, string | undefined> = process.env,
): GeniusApiTarget {
  const token = env.GENIUS_ACCESS_TOKEN?.trim() || null;
  const raw = env.GENIUS_API?.trim().toLowerCase();
  const mode: GeniusApiMode =
    raw === "web" || raw === "website" || raw === "public"
      ? "web"
      : raw === "official" || raw === "dev" || raw === "developer"
        ? "official"
        : token
          ? "official"
          : "web";

  if (mode === "official" && !token) {
    throw new Error("GENIUS_ACCESS_TOKEN is required when GENIUS_API=official");
  }

  return {
    mode,
    origin: mode === "official" ? "https://api.genius.com" : "https://genius.com/api",
    token: mode === "official" ? token : null,
  };
}
