/** A rules document's language as a paraglide locale. Mirrors the `rules.language` CHECK. */
export const RULE_LANGUAGES = ["en", "fr", "ko", "zh-Hans"] as const;

export function isRuleLanguage(value: unknown): value is (typeof RULE_LANGUAGES)[number] {
  return (RULE_LANGUAGES as readonly unknown[]).includes(value);
}

export function sortRuleLanguages(
  languages: Iterable<(typeof RULE_LANGUAGES)[number]>,
): (typeof RULE_LANGUAGES)[number][] {
  const present = new Set(languages);
  return RULE_LANGUAGES.filter((language) => present.has(language));
}

export function formatRuleNumber(ruleNumber: string): string {
  return ruleNumber.replace(/\.$/u, "");
}

export function ruleNumberDepth(ruleNumber: string): number {
  return Math.min(ruleNumber.split(".").length - 1, 3);
}

// Tail is bounded (optional .digit segments, one optional .letter, final optional .digit)
// so "rule 540.4.b. Continue" matches "540.4.b", not "540.4.b.C…".
const RULE_NUMBER_TAIL = String.raw`(?:\.\d+)*(?:\.[a-z](?:\.\d+)?)?`;

// Korean cites "규칙 제197조" (article 197), and "핵심 규칙" is the Core Rules.
export const RULE_REFERENCE_REGEX = new RegExp(
  [
    String.raw`\b(?<keyword>[Rr]ules?|[Rr]ègles?|CR)\s+(?<dotted>\d+${RULE_NUMBER_TAIL})`,
    String.raw`(?<koCore>핵심\s+)?(?:규칙\s+)?제(?<article>\d+${RULE_NUMBER_TAIL})조`,
    String.raw`\b(?<bare>\d{3}(?:\.\d+)+(?:\.[a-z](?:\.\d+)?)?)`,
  ].join("|"),
  "gu",
);

export interface RuleReference {
  ruleNumber: string;
  inCoreRules: boolean;
}

export function ruleReferenceFromMatch(
  groups: Readonly<Record<string, string | undefined>> | undefined,
): RuleReference | null {
  const ruleNumber = groups?.dotted ?? groups?.article ?? groups?.bare;
  if (ruleNumber === undefined) {
    return null;
  }
  return { ruleNumber, inCoreRules: groups?.keyword === "CR" || groups?.koCore !== undefined };
}

const TITLE_WORD = "[A-Z][A-Za-z0-9-]*";
const HEADING_STOP_WORD = "(?:of|or|the|and|to|a|an)";
const TITLE_CASE_PHRASE = `${TITLE_WORD}(?:\\s+(?:${TITLE_WORD}|${HEADING_STOP_WORD}))*`;
const TERM_DEFINITION_REGEX = new RegExp(`^\\*(${TITLE_CASE_PHRASE})\\*\\.?$`, "u");
const HEADING_TEXT_REGEX = new RegExp(`^${TITLE_CASE_PHRASE}$`, "u");

function addTermAnchor(map: Map<string, string>, term: string, ruleNumber: string): void {
  const key = term.toLowerCase();
  map.set(key, ruleNumber);
  if (/[^aeiou]ies$/u.test(key)) {
    map.set(`${key.slice(0, -3)}y`, ruleNumber);
  } else if (/[^aeiou]y$/u.test(key)) {
    map.set(`${key.slice(0, -1)}ies`, ruleNumber);
  } else if (key.endsWith("s") && key.length > 2) {
    map.set(key.slice(0, -1), ruleNumber);
  } else if (key.length > 1) {
    map.set(`${key}s`, ruleNumber);
  }
}

export function buildTermAnchors(
  rules: readonly { ruleNumber: string; ruleType: string; depth: number; content: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const rule of rules) {
    if (rule.ruleType !== "text" || rule.depth !== 0) {
      continue;
    }
    if (rule.content.includes("*")) {
      continue;
    }
    if (!HEADING_TEXT_REGEX.test(rule.content)) {
      continue;
    }
    for (const part of rule.content.split(/\s+and\s+/iu)) {
      const term = part.trim();
      if (term.length > 0 && /^[A-Z]/u.test(term)) {
        addTermAnchor(map, term, rule.ruleNumber);
      }
    }
  }
  for (const rule of rules) {
    if (rule.ruleType !== "text") {
      continue;
    }
    const term = rule.content.match(TERM_DEFINITION_REGEX)?.[1];
    if (term !== undefined) {
      addTermAnchor(map, term, rule.ruleNumber);
    }
  }
  for (const rule of rules) {
    if (rule.ruleType !== "subtitle") {
      continue;
    }
    for (const part of rule.content.split(/\s+and\s+/iu)) {
      const term = part.trim();
      if (term.length > 0 && /^[A-Z]/u.test(term)) {
        addTermAnchor(map, term, rule.ruleNumber);
      }
    }
  }
  return map;
}

const FRENCH_ARTICLE_REGEX = /^(?:le|la|les|l['’])\s*/u;
const FRENCH_LINK_WORDS = new Set([
  "de",
  "des",
  "du",
  "d'",
  "à",
  "au",
  "aux",
  "en",
  "et",
  "la",
  "le",
  "les",
]);

function frenchNumberForms(term: string): string[] {
  const words = term.split(/\s+/u);
  const inflect = (toPlural: boolean) =>
    words
      .map((word) => {
        if (FRENCH_LINK_WORDS.has(word) || word.includes("'") || word.length < 3) {
          return word;
        }
        if (toPlural) {
          return /[sx]$/u.test(word) ? word : `${word}s`;
        }
        return /[^s]s$/u.test(word) ? word.slice(0, -1) : word;
      })
      .join(" ");
  return [...new Set([term, inflect(true), inflect(false)])];
}

export function buildTranslatedTermAnchors(
  englishAnchors: ReadonlyMap<string, string>,
  rules: readonly { ruleNumber: string; content: string }[],
  language: (typeof RULE_LANGUAGES)[number],
): Map<string, string> {
  const map = new Map<string, string>();
  if (language !== "fr") {
    return map;
  }
  const contentByNumber = new Map(rules.map((rule) => [rule.ruleNumber, rule.content]));
  for (const ruleNumber of new Set(englishAnchors.values())) {
    const content = contentByNumber.get(ruleNumber);
    if (content === undefined || content.includes("\n")) {
      continue;
    }
    const heading = content
      .replaceAll("*", "")
      .replace(/[\s.:]+$/u, "")
      .trim()
      .toLowerCase();
    for (const part of heading.split(/\s+et\s+/u)) {
      const term = part.replace(FRENCH_ARTICLE_REGEX, "").trim();
      if (term.length < 2 || term.split(/\s+/u).length > 6) {
        continue;
      }
      for (const form of frenchNumberForms(term)) {
        if (!map.has(form)) {
          map.set(form, ruleNumber);
        }
      }
    }
  }
  return map;
}

/** Natural order: `100 < 100.1 < 100.1.a < 200 < 1000`. */
export function compareRuleNumbers(a: string, b: string): number {
  const partsA = a.split(".");
  const partsB = b.split(".");
  for (const [i, partA] of partsA.entries()) {
    const partB = partsB[i];
    if (partB === undefined) {
      break;
    }
    const numA = Number(partA);
    const numB = Number(partB);
    const aIsNum = !Number.isNaN(numA) && partA !== "";
    const bIsNum = !Number.isNaN(numB) && partB !== "";
    if (aIsNum && bIsNum) {
      if (numA !== numB) {
        return numA - numB;
      }
    } else if (aIsNum) {
      return -1;
    } else if (bIsNum) {
      return 1;
    } else {
      const cmp = partA.localeCompare(partB);
      if (cmp !== 0) {
        return cmp;
      }
    }
  }
  return partsA.length - partsB.length;
}
