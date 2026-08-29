export function asArtistId(value: string | null): number | undefined {
  const n = Number(value ?? "");
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

export function clampPage(value: string | null) {
  const n = Number(value ?? "1");
  if (!Number.isInteger(n)) return 1;
  return Math.min(40, Math.max(1, n));
}

export function clip(value: string, max: number) {
  return value.slice(0, max);
}

export function asDate(value: string | null): string | undefined {
  if (!value) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}
