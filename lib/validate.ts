export function asIdList(value: string | null, max = 200): number[] {
  if (!value) return [];
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const part of value.split(",")) {
    const n = Number(part);
    if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    ids.push(n);
    if (ids.length >= max) break;
  }
  return ids;
}

export function asArtistId(value: string | null): number | undefined {
  const n = Number(value ?? "");
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

export function clampPage(value: string | null) {
  const n = Number(value ?? "1");
  if (!Number.isInteger(n)) return 1;
  return Math.min(200, Math.max(1, n));
}

export function clip(value: string, max: number) {
  return value.slice(0, max);
}

export function asDate(value: string | null): string | undefined {
  if (!value) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}
