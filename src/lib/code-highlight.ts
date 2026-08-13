/**
 * Tiny dependency-free syntax highlighter used by the developer workspace.
 * Produces flat tokens per line so the renderer can keep line numbers.
 */

export type TokenType =
  | "plain"
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "type"
  | "function"
  | "operator"
  | "punctuation"
  | "tag"
  | "attr";

export type CodeToken = { type: TokenType; value: string };

const KEYWORDS: Record<string, string[]> = {
  ts: [
    "abstract","as","async","await","break","case","catch","class","const","continue","default","delete","do","else","enum","export","extends","finally","for","from","function","get","if","implements","import","in","instanceof","interface","let","new","of","private","protected","public","readonly","return","satisfies","set","static","super","switch","this","throw","try","type","typeof","var","void","while","yield",
  ],
  py: [
    "and","as","assert","async","await","break","class","continue","def","del","elif","else","except","finally","for","from","global","if","import","in","is","lambda","nonlocal","not","or","pass","raise","return","try","while","with","yield",
  ],
  sql: [
    "select","from","where","insert","into","values","update","set","delete","join","left","right","inner","outer","on","group","by","order","limit","offset","create","table","alter","drop","and","or","not","null","as","distinct","having","union","returning","with",
  ],
  json: ["true", "false", "null"],
  bash: ["if","then","else","fi","for","in","do","done","while","case","esac","function","export","local","return","echo"],
  css: ["important", "media", "import", "keyframes", "supports"],
};

const LITERALS = ["true", "false", "null", "undefined", "None", "True", "False"];

function keywordsFor(language: string) {
  const lang = language.toLowerCase();
  if (["ts", "tsx", "js", "jsx", "javascript", "typescript"].includes(lang)) return KEYWORDS['ts']!;
  if (["py", "python"].includes(lang)) return KEYWORDS['py']!;
  if (lang === "sql") return KEYWORDS['sql']!;
  if (lang === "json") return KEYWORDS['json']!;
  if (["bash", "sh", "shell"].includes(lang)) return KEYWORDS['bash']!;
  if (["css", "scss"].includes(lang)) return KEYWORDS['css']!;
  if (["html", "xml"].includes(lang)) return [];
  return KEYWORDS['ts']!;
}

const COMMENT_PREFIX: Record<string, string> = {
  py: "#",
  python: "#",
  bash: "#",
  sh: "#",
  shell: "#",
  sql: "--",
  yaml: "#",
  yml: "#",
};

/** Splits a single line of source into coloured tokens. */
export function tokenizeLine(line: string, language: string): CodeToken[] {
  const lang = language.toLowerCase();
  const keywords = keywordsFor(lang);
  const lineComment = COMMENT_PREFIX[lang] ?? "//";
  const tokens: CodeToken[] = [];
  let i = 0;
  const push = (type: TokenType, value: string) => {
    const last = tokens[tokens.length - 1];
    if (last && last.type === type) last.value += value;
    else tokens.push({ type, value });
  };

  while (i < line.length) {
    const rest = line.slice(i);

    // whole-line and inline comments
    if (rest.startsWith(lineComment) || rest.startsWith("/*") || rest.startsWith("*/")) {
      push("comment", rest);
      break;
    }

    // strings and template literals
    const quote = rest[0];
    if (quote === '"' || quote === "'" || quote === "`") {
      let j = 1;
      while (j < rest.length) {
        if (rest[j] === "\\") j += 2;
        else if (rest[j] === quote) {
          j += 1;
          break;
        } else j += 1;
      }
      push("string", rest.slice(0, j));
      i += j;
      continue;
    }

    // html/jsx tags
    const tagMatch = /^<\/?[A-Za-z][\w.-]*/.exec(rest);
    if (tagMatch && ["html", "xml", "jsx", "tsx"].includes(lang)) {
      push("tag", tagMatch[0]);
      i += tagMatch[0].length;
      continue;
    }

    // numbers
    const numMatch = /^(0x[\da-fA-F]+|\d+(\.\d+)?([eE][+-]?\d+)?)/.exec(rest);
    if (numMatch) {
      push("number", numMatch[0]);
      i += numMatch[0].length;
      continue;
    }

    // identifiers
    const idMatch = /^[A-Za-z_$@#][\w$]*/.exec(rest);
    if (idMatch) {
      const word = idMatch[0];
      const lower = word.toLowerCase();
      const after = rest.slice(word.length);
      if (keywords.includes(word) || keywords.includes(lower)) push("keyword", word);
      else if (LITERALS.includes(word)) push("number", word);
      else if (/^\s*\(/.test(after)) push("function", word);
      else if (/^[A-Z]/.test(word)) push("type", word);
      else if (/^\s*[:=]/.test(after) && ["css", "scss", "html", "xml"].includes(lang))
        push("attr", word);
      else push("plain", word);
      i += word.length;
      continue;
    }

    // operators and punctuation
    if (/^[+\-*/%=<>!&|^~?]/.test(rest)) {
      push("operator", rest[0]!);
      i += 1;
      continue;
    }
    if (/^[{}()[\];:,.]/.test(rest)) {
      push("punctuation", rest[0]!);
      i += 1;
      continue;
    }

    push("plain", rest[0]!);
    i += 1;
  }

  return tokens.length > 0 ? tokens : [{ type: "plain", value: "" }];
}

export const TOKEN_CLASS: Record<TokenType, string> = {
  plain: "text-foreground",
  comment: "text-muted-foreground italic",
  string: "text-[var(--chart-3)]",
  number: "text-[var(--chart-4)]",
  keyword: "text-[var(--chart-1)] font-semibold",
  type: "text-[var(--chart-2)]",
  function: "text-[var(--chart-5)]",
  operator: "text-muted-foreground",
  punctuation: "text-muted-foreground",
  tag: "text-[var(--chart-1)]",
  attr: "text-[var(--chart-2)]",
};

export const HIGHLIGHT_LANGUAGES = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "python",
  "sql",
  "json",
  "bash",
  "css",
  "html",
] as const;
