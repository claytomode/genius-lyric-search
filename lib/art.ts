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

export function allowedImageType(contentType: string | null): string | null {
  if (!contentType) return null;
  const type = contentType.split(";")[0]?.trim().toLowerCase();
  if (!type || !IMAGE_TYPES.has(type)) return null;
  return type;
}
