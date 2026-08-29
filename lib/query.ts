export type QueryNode =
  | { type: "term"; value: string; fuzz: number }
  | { type: "phrase"; words: string[]; slop: number }
  | { type: "and"; children: QueryNode[]; implicit: boolean }
  | { type: "or"; children: QueryNode[] }
  | { type: "not"; child: QueryNode };

export type ParsedQuery = {
  ast: QueryNode;
  source: string;
  explicit: boolean;
};

type Token =
  | { kind: "word"; value: string; fuzz: number }
  | { kind: "phrase"; words: string[]; slop: number }
  | { kind: "and" }
  | { kind: "or" }
  | { kind: "not" }
  | { kind: "lparen" }
  | { kind: "rparen" };

const KEYWORDS = new Set(["AND", "OR", "NOT"]);

function readFuzz(input: string, start: number): { fuzz: number; next: number } {
  if (input[start] !== "~") return { fuzz: 0, next: start };
  let i = start + 1;
  let digits = "";
  while (i < input.length && /[0-9]/.test(input[i])) {
    digits += input[i];
    i += 1;
  }
  return { fuzz: Math.min(digits ? Number(digits) : 1, 2), next: i };
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i += 1;
      continue;
    }
    if (ch === "-") {
      const next = input[i + 1];
      if (next && !/\s/.test(next) && next !== "-") {
        tokens.push({ kind: "not" });
        i += 1;
        continue;
      }
    }
    if (ch === '"') {
      i += 1;
      let body = "";
      while (i < input.length && input[i] !== '"') {
        body += input[i];
        i += 1;
      }
      if (input[i] === '"') i += 1;
      const fuzz = readFuzz(input, i);
      i = fuzz.next;
      const words = body
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (words.length) {
        tokens.push({ kind: "phrase", words, slop: fuzz.fuzz });
      }
      continue;
    }

    let word = "";
    while (i < input.length && !/\s|"|\(|\)/.test(input[i])) {
      word += input[i];
      i += 1;
    }
    if (!word) continue;
    if (KEYWORDS.has(word)) {
      tokens.push({ kind: word.toLowerCase() as "and" | "or" | "not" });
      continue;
    }
    const tilde = word.indexOf("~");
    const value = tilde >= 0 ? word.slice(0, tilde) : word;
    const extra = tilde >= 0 ? readFuzz(word, tilde).fuzz : 0;
    if (value) tokens.push({ kind: "word", value, fuzz: extra });
  }

  return tokens;
}

class Parser {
  constructor(private tokens: Token[]) {}
  private i = 0;

  peek() {
    return this.tokens[this.i];
  }

  take() {
    const token = this.tokens[this.i];
    this.i += 1;
    return token;
  }

  parse(): QueryNode {
    const node = this.parseOr();
    return node;
  }

  private parseOr(): QueryNode {
    const children = [this.parseAnd()];
    while (this.peek()?.kind === "or") {
      this.take();
      children.push(this.parseAnd());
    }
    return children.length === 1 ? children[0] : { type: "or", children };
  }

  private parseAnd(): QueryNode {
    const children: QueryNode[] = [];
    let implicit = true;
    children.push(this.parseNot());
    while (this.peek() && this.peek()!.kind !== "or" && this.peek()!.kind !== "rparen") {
      if (this.peek()!.kind === "and") {
        implicit = false;
        this.take();
      }
      if (!this.peek() || this.peek()!.kind === "or" || this.peek()!.kind === "rparen") break;
      children.push(this.parseNot());
    }
    if (children.length === 1) return children[0];
    return { type: "and", children, implicit };
  }

  private parseNot(): QueryNode {
    if (this.peek()?.kind === "not") {
      this.take();
      return { type: "not", child: this.parseNot() };
    }
    return this.parseTerm();
  }

  private parseTerm(): QueryNode {
    const token = this.take();
    if (!token) return { type: "term", value: "", fuzz: 0 };
    if (token.kind === "lparen") {
      const inner = this.parseOr();
      if (this.peek()?.kind === "rparen") this.take();
      return inner;
    }
    if (token.kind === "phrase") {
      return { type: "phrase", words: token.words, slop: token.slop };
    }
    if (token.kind === "word") {
      return { type: "term", value: token.value, fuzz: token.fuzz };
    }
    return { type: "term", value: "", fuzz: 0 };
  }
}

function isExplicit(node: QueryNode): boolean {
  switch (node.type) {
    case "term":
      return node.fuzz > 0;
    case "phrase":
      return true;
    case "not":
      return true;
    case "or":
      return true;
    case "and":
      return !node.implicit || node.children.some(isExplicit);
    default:
      return false;
  }
}

export function parseQuery(input: string): ParsedQuery {
  const source = input.trim();
  if (!source) {
    return { ast: { type: "term", value: "", fuzz: 0 }, source, explicit: false };
  }
  try {
    const ast = new Parser(tokenize(source)).parse();
    return { ast, source, explicit: isExplicit(ast) };
  } catch {
    return {
      ast: { type: "term", value: source, fuzz: 0 },
      source,
      explicit: false,
    };
  }
}

export function formatQuery(node: QueryNode): string {
  switch (node.type) {
    case "term":
      return node.fuzz ? `${node.value}~${node.fuzz}` : node.value;
    case "phrase": {
      const body = `"${node.words.join(" ")}"`;
      return node.slop ? `${body}~${node.slop}` : body;
    }
    case "not":
      return `NOT ${formatQuery(node.child)}`;
    case "and":
      return node.children
        .map((child) => (child.type === "or" ? `(${formatQuery(child)})` : formatQuery(child)))
        .join(node.implicit ? " " : " AND ");
    case "or":
      return node.children.map((child) => formatQuery(child)).join(" OR ");
  }
}

function cartesian(lists: string[][]): string[] {
  return lists.reduce<string[]>((acc, list) => {
    if (!acc.length) return list.filter(Boolean);
    const next: string[] = [];
    for (const left of acc) {
      for (const right of list) {
        const combined = [left, right].filter(Boolean).join(" ");
        if (combined && !next.includes(combined)) next.push(combined);
        if (next.length >= 4) return next;
      }
    }
    return next;
  }, []);
}

export function geniusQueries(node: QueryNode): string[] {
  if (node.type === "or") {
    const queries = node.children.flatMap(geniusQueries);
    return queries.length ? queries.slice(0, 4) : [""];
  }
  if (node.type === "and") {
    return cartesian(node.children.map(geniusQueries));
  }
  if (node.type === "not") return [""];
  if (node.type === "phrase") return [`"${node.words.join(" ")}"`];
  return node.value ? [node.value] : [""];
}

export function queryFeatures(node: QueryNode) {
  const features = { phrase: false, boolean: false, fuzzy: false, proximity: false, not: false };
  const walk = (current: QueryNode) => {
    if (current.type === "phrase") {
      features.phrase = true;
      if (current.slop > 0) features.proximity = true;
    }
    if (current.type === "term" && current.fuzz > 0) features.fuzzy = true;
    if (current.type === "or" || (current.type === "and" && !current.implicit)) features.boolean = true;
    if (current.type === "not") features.not = true;
    if (current.type === "and" || current.type === "or") current.children.forEach(walk);
    if (current.type === "not") walk(current.child);
  };
  walk(node);
  return features;
}
