import type { RuleLanguage } from "./types/api/rules.js";

export interface RuleSection {
  kind: "text" | "example";
  content: string;
}

const SECTION_MARKERS: Partial<Record<RuleLanguage, { example: RegExp; seeAlso: RegExp }>> = {
  en: { example: /^\s*\*?Examples?:/u, seeAlso: /^\s*\*?See\b/u },
  fr: { example: /^\s*\*?Exemples?\*?\s*:/u, seeAlso: /^\s*\*?Voir\b/u },
  ko: { example: /^\s*\*?예시\*?\s*:/u, seeAlso: /참조하세요\.?\*?\s*$/u },
};

export function splitRuleSections(content: string, language: RuleLanguage = "en"): RuleSection[] {
  const markers = SECTION_MARKERS[language];
  if (markers === undefined) {
    return content.trim() === "" ? [] : [{ kind: "text", content: content.trim() }];
  }
  const groups: { kind: RuleSection["kind"]; lines: string[] }[] = [];
  for (const line of content.split("\n")) {
    const last = groups.at(-1);
    const startsExample = markers.example.test(line);
    const kind: RuleSection["kind"] =
      startsExample || (last?.kind === "example" && !markers.seeAlso.test(line))
        ? "example"
        : "text";
    if (last === undefined || startsExample || kind !== last.kind) {
      groups.push({ kind, lines: [line] });
    } else {
      last.lines.push(line);
    }
  }
  return groups
    .map((group) => ({ kind: group.kind, content: group.lines.join("\n").trim() }))
    .filter((section) => section.content !== "");
}

export function ruleExampleText(content: string, language: RuleLanguage = "en"): string {
  return splitRuleSections(content, language)
    .filter((section) => section.kind === "example")
    .map((section) => section.content)
    .join("\n");
}

function escapeRegex(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

// Korean attaches particles to a name ("말괄량이에는"); any other Hangul after it means a longer word.
const KOREAN_PARTICLES = [
  "이라는",
  "이라고",
  "이라면",
  "에서는",
  "에게는",
  "으로는",
  "으로써",
  "까지",
  "부터",
  "처럼",
  "보다",
  "에서",
  "에게",
  "한테",
  "으로",
  "이나",
  "이며",
  "이고",
  "이란",
  "라는",
  "라고",
  "에는",
  "에도",
  "와의",
  "과의",
  "로의",
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "의",
  "에",
  "와",
  "과",
  "로",
  "도",
  "만",
  "나",
  "란",
].join("|");

const MENTION_END: Partial<Record<RuleLanguage, string>> = {
  ko: String.raw`(?=(?:${KOREAN_PARTICLES})*(?![\p{L}\p{N}]))`,
};

export function cardMentionPattern(
  names: Iterable<string>,
  language: RuleLanguage = "en",
): RegExp | null {
  const sorted = [...new Set(names)].filter(Boolean).toSorted((a, b) => b.length - a.length);
  if (sorted.length === 0) {
    return null;
  }
  const end = MENTION_END[language] ?? String.raw`(?![\p{L}\p{N}])`;
  return new RegExp(
    String.raw`(?<![\p{L}\p{N}])(?:${sorted.map((name) => escapeRegex(name)).join("|")})${end}`,
    "gu",
  );
}

// Quoted text is card wording and *emphasis* marks game terms, so neither is linked.
function linkableRuns(text: string): { text: string; linkable: boolean }[] {
  const runs: { text: string; linkable: boolean }[] = [];
  let start = 0;
  let inQuote = false;
  let inEmphasis = false;
  const push = (end: number, linkable: boolean) => {
    if (end > start) {
      runs.push({ text: text.slice(start, end), linkable });
    }
    start = end;
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const wasLinkable = !inQuote && !inEmphasis;
    if (char === "“" || (char === '"' && !inQuote)) {
      push(index, wasLinkable);
      inQuote = true;
    } else if (char === "”" || (char === '"' && inQuote)) {
      inQuote = false;
      push(index + 1, false);
    } else if (char === "*") {
      push(index, wasLinkable);
      inEmphasis = !inEmphasis;
    }
  }
  push(text.length, !inQuote && !inEmphasis);
  return runs;
}

export function findCardMentions(text: string, pattern: RegExp): Set<string> {
  const found = new Set<string>();
  for (const run of linkableRuns(text)) {
    if (run.linkable) {
      for (const match of run.text.matchAll(pattern)) {
        found.add(match[0]);
      }
    }
  }
  return found;
}

export function linkCardMentions(
  text: string,
  pattern: RegExp,
  slugsByName: ReadonlyMap<string, string>,
): string {
  return linkableRuns(text)
    .map((run) =>
      run.linkable
        ? run.text.replaceAll(pattern, (name) => {
            const slug = slugsByName.get(name);
            return slug === undefined ? name : `[${name}](/cards/${slug})`;
          })
        : run.text,
    )
    .join("");
}
