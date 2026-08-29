import type { HighlightRange } from "./types";
import type { QueryNode } from "./query";

export type MatchKind = "phrase" | "proximity" | "all" | "any" | "fuzzy" | "near";

export type MatchResult = {
  ok: boolean;
  score: number;
  kind: MatchKind;
  ranges: HighlightRange[];
  fuzzy: boolean;
};

type Token = { word: string; start: number; end: number };

function normalize(word: string) {
  return word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

export function splitTokens(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /[\p{L}\p{N}']+/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    tokens.push({ word: match[0], start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

export function levenshtein(a: string, b: string, cap = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j++) {
      const insert = prev[j] + 1;
      const del = prev[j - 1] + 1;
      const sub = prevDiag + (a[i - 1] === b[j - 1] ? 0 : 1);
      prevDiag = prev[j];
      prev[j] = Math.min(insert, del, sub);
      if (prev[j] < rowMin) rowMin = prev[j];
    }
    if (rowMin > cap) return cap + 1;
  }
  return prev[b.length];
}

function termHits(tokens: Token[], value: string, fuzz: number): Token[] {
  const needle = normalize(value);
  if (!needle) return [];
  const hits: Token[] = [];
  for (const token of tokens) {
    const hay = normalize(token.word);
    if (!hay) continue;
    if (hay === needle) {
      hits.push(token);
      continue;
    }
    if (fuzz > 0 && levenshtein(needle, hay, fuzz) <= fuzz) hits.push(token);
  }
  return hits;
}

function windowContains(
  tokens: Token[],
  words: string[],
  slop: number,
  fuzz: number,
): { ranges: HighlightRange[]; span: number } | null {
  if (!words.length) return null;
  const needed = words.map(normalize).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const ranges: HighlightRange[] = [];
    let cursor = i;
    let ok = true;
    for (const word of needed) {
      let found = -1;
      const limit = Math.min(tokens.length, cursor + 1 + slop);
      for (let j = cursor; j < (cursor === i ? tokens.length : limit); j++) {
        const hay = normalize(tokens[j].word);
        if (hay === word || (fuzz > 0 && levenshtein(word, hay, fuzz) <= fuzz)) {
          found = j;
          ranges.push({ start: tokens[j].start, end: tokens[j].end });
          break;
        }
        if (cursor !== i && j >= limit - 1) break;
      }
      if (found === -1) {
        ok = false;
        break;
      }
      cursor = found + 1;
    }
    if (ok && ranges.length) {
      const span = ranges[ranges.length - 1].end - ranges[0].start;
      return { ranges, span };
    }
  }
  return null;
}

type Eval = { ok: boolean; score: number; kind: MatchKind; ranges: HighlightRange[]; fuzzy: boolean };

function mergeRanges(ranges: HighlightRange[]) {
  return [...ranges].sort((a, b) => a.start - b.start);
}

function evaluateNode(node: QueryNode, tokens: Token[], autoFuzz: number): Eval {
  switch (node.type) {
    case "term": {
      const fuzz = Math.max(node.fuzz, autoFuzz);
      const hits = termHits(tokens, node.value, fuzz);
      if (!hits.length) return { ok: false, score: 0, kind: "any", ranges: [], fuzzy: fuzz > 0 };
      const exact = termHits(tokens, node.value, 0).length > 0;
      return {
        ok: true,
        score: exact ? 12 : 6,
        kind: exact ? "any" : "fuzzy",
        ranges: hits.map((hit) => ({ start: hit.start, end: hit.end })),
        fuzzy: !exact,
      };
    }
    case "phrase": {
      const fuzz = autoFuzz;
      const hit = windowContains(tokens, node.words, node.slop, fuzz);
      if (!hit) return { ok: false, score: 0, kind: node.slop ? "proximity" : "phrase", ranges: [], fuzzy: fuzz > 0 };
      const tightness = Math.max(0, 40 - hit.span / 8);
      return {
        ok: true,
        score: node.slop ? 55 + tightness : 80,
        kind: node.slop ? "proximity" : "phrase",
        ranges: hit.ranges,
        fuzzy: fuzz > 0,
      };
    }
    case "not": {
      const child = evaluateNode(node.child, tokens, autoFuzz);
      return { ok: !child.ok, score: child.ok ? 0 : 8, kind: "all", ranges: [], fuzzy: false };
    }
    case "and": {
      const children = node.children.map((child) => evaluateNode(child, tokens, autoFuzz));
      const ranges = mergeRanges(children.flatMap((child) => child.ranges));
      const fuzzy = children.some((child) => child.fuzzy);
      if (node.implicit) {
        const ok = children.every((child) => child.ok);
        if (!ok) return { ok: false, score: 0, kind: "any", ranges: [], fuzzy };
        const inOrder = windowContains(
          tokens,
          node.children.flatMap((child) =>
            child.type === "term" ? [child.value] : child.type === "phrase" ? child.words : [],
          ),
          12,
          autoFuzz,
        );
        const score = children.reduce((sum, child) => sum + child.score, 0) + (inOrder ? 25 : 0);
        return {
          ok: true,
          score,
          kind: inOrder ? "phrase" : "all",
          ranges: inOrder?.ranges ?? ranges,
          fuzzy,
        };
      }
      const ok = children.every((child) => child.ok);
      return {
        ok,
        score: ok ? children.reduce((sum, child) => sum + child.score, 0) + 20 : 0,
        kind: "all",
        ranges,
        fuzzy,
      };
    }
    case "or": {
      const children = node.children.map((child) => evaluateNode(child, tokens, autoFuzz));
      const matched = children.filter((child) => child.ok);
      if (!matched.length) return { ok: false, score: 0, kind: "any", ranges: [], fuzzy: false };
      const best = matched.sort((a, b) => b.score - a.score)[0];
      return {
        ok: true,
        score: best.score + 4,
        kind: best.kind,
        ranges: mergeRanges(matched.flatMap((child) => child.ranges)),
        fuzzy: matched.some((child) => child.fuzzy),
      };
    }
  }
}

export function matchQuery(node: QueryNode, text: string, autoFuzz = 0): MatchResult {
  const tokens = splitTokens(text);
  const result = evaluateNode(node, tokens, autoFuzz);
  if (autoFuzz > 0 && result.ok && result.fuzzy) {
    return { ...result, kind: "near" };
  }
  return result;
}

export function matchKindLabel(kind: MatchKind) {
  switch (kind) {
    case "phrase":
      return "Exact phrase";
    case "proximity":
      return "Near match";
    case "all":
      return "All terms";
    case "fuzzy":
      return "Fuzzy";
    case "near":
      return "Near miss";
    default:
      return "Best match";
  }
}
