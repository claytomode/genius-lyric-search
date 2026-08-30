import type { HighlightRange, MatchKind } from "./types";
import type { QueryNode } from "./query";

export type MatchResult = {
  ok: boolean;
  score: number;
  kind: MatchKind;
  ranges: HighlightRange[];
  fuzzy: boolean;
};

type Token = { word: string; start: number; end: number };

function normalize(word: string) {
  return word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
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
  const hits: Token[] = [];
  for (const token of tokens) {
    if (tokenMatches(token, value, fuzz)) hits.push(token);
  }
  return hits;
}

function tokenMatches(token: Token, word: string, fuzz: number) {
  const hay = normalize(token.word);
  const needle = normalize(word);
  if (!hay || !needle) return false;
  if (hay === needle) return true;
  return fuzz > 0 && levenshtein(needle, hay, fuzz) <= fuzz;
}

function windowContains(
  tokens: Token[],
  words: string[],
  slop: number,
  fuzz: number,
): { ranges: HighlightRange[]; span: number } | null {
  if (!words.length) return null;
  const needed = words.filter((word) => normalize(word));
  if (!needed.length) return null;

  let best: { ranges: HighlightRange[]; span: number } | null = null;
  for (let i = 0; i < tokens.length; i++) {
    if (!tokenMatches(tokens[i], needed[0], fuzz)) continue;
    const ranges: HighlightRange[] = [{ start: tokens[i].start, end: tokens[i].end }];
    let cursor = i + 1;
    let ok = true;
    for (let w = 1; w < needed.length; w++) {
      const limit = slop === 0 ? cursor + 1 : Math.min(tokens.length, cursor + slop + 1);
      let found = -1;
      for (let j = cursor; j < limit; j++) {
        if (tokenMatches(tokens[j], needed[w], fuzz)) {
          found = j;
          ranges.push({ start: tokens[j].start, end: tokens[j].end });
          break;
        }
      }
      if (found === -1) {
        ok = false;
        break;
      }
      cursor = found + 1;
    }
    if (!ok) continue;
    const span = ranges[ranges.length - 1].end - ranges[0].start;
    if (!best || span < best.span) best = { ranges, span };
  }
  return best;
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
        const words = node.children.flatMap((child) =>
          child.type === "term" ? [child.value] : child.type === "phrase" ? child.words : [],
        );
        const consecutive = windowContains(tokens, words, 0, autoFuzz);
        const inOrder = consecutive ?? windowContains(tokens, words, 2, autoFuzz);
        if (!inOrder) return { ok: false, score: 0, kind: "any", ranges: [], fuzzy };
        const score = children.reduce((sum, child) => sum + child.score, 0) + (consecutive ? 30 : 20);
        return {
          ok: true,
          score,
          kind: consecutive ? "phrase" : "proximity",
          ranges: inOrder.ranges,
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
