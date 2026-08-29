const windows = new Map<string, number[]>();

export function rateLimit(ip: string, bucket: string, max: number, windowMs: number) {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const start = now - windowMs;
  const stamps = (windows.get(key) ?? []).filter((time) => time > start);
  if (stamps.length >= max) {
    windows.set(key, stamps);
    return false;
  }
  stamps.push(now);
  windows.set(key, stamps);
  return true;
}

export function clientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip") || "unknown";
}
