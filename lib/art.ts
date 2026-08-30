export const GENIUS_IMAGE_HOSTS = new Set(["images.genius.com", "images.rapgenius.com"]);

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function safeGeniusImageUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "443") return null;
  if (!GENIUS_IMAGE_HOSTS.has(url.hostname)) return null;
  return url;
}

/** Prefer a ~300px Genius variant so list tiles are not 1000×1000 PNGs. */
export function compactGeniusImage(raw: string | null, maxEdge = 300): string | null {
  if (!raw || !safeGeniusImageUrl(raw)) return null;
  return raw.replace(/\.(\d+)x(\d+)x(\d+)\./, (_, w, h, n) => {
    const width = Number(w);
    const height = Number(h);
    if (!width || !height || Math.max(width, height) <= maxEdge) {
      return `.${w}x${h}x${n}.`;
    }
    return `.${maxEdge}x${maxEdge}x${n}.`;
  });
}

export function allowedImageType(contentType: string | null): string | null {
  if (!contentType) return null;
  const type = contentType.split(";")[0]?.trim().toLowerCase();
  if (!type || !IMAGE_TYPES.has(type)) return null;
  return type;
}
