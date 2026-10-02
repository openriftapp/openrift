import { RULE_REFERENCE_REGEX, ruleReferenceFromMatch } from "./rules.js";
import type { RuleLanguage } from "./types/api/rules.js";

export interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
}

export interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

function splitTextOnRuleReferences(text: string, language: RuleLanguage): MdNode[] {
  const result: MdNode[] = [];
  let last = 0;
  RULE_REFERENCE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = RULE_REFERENCE_REGEX.exec(text);
  while (match !== null) {
    if (match.index > last) {
      result.push({ type: "text", value: text.slice(last, match.index) });
    }
    const reference = ruleReferenceFromMatch(match.groups);
    if (reference === null) {
      match = RULE_REFERENCE_REGEX.exec(text);
      continue;
    }
    const anchor = `#rule-${reference.ruleNumber}`;
    const url = reference.inCoreRules ? `/rules/core?lang=${language}${anchor}` : anchor;
    result.push({
      type: "link",
      url,
      children: [{ type: "text", value: match[0] }],
    });
    last = match.index + match[0].length;
    match = RULE_REFERENCE_REGEX.exec(text);
  }
  if (last < text.length) {
    result.push({ type: "text", value: text.slice(last) });
  }
  return result;
}

function visitMdastTextNodes(node: MdNode, language: RuleLanguage): void {
  if (!node.children) {
    return;
  }
  const rebuilt: MdNode[] = [];
  for (const child of node.children) {
    if (child.type === "link") {
      // Don't relink text inside an existing link.
      rebuilt.push(child);
      continue;
    }
    if (child.type === "text" && typeof child.value === "string") {
      const replacements = splitTextOnRuleReferences(child.value, language);
      const [only] = replacements;
      const isUnchanged =
        replacements.length === 1 && only?.type === "text" && only.value === child.value;
      rebuilt.push(...(isUnchanged ? [child] : replacements));
      continue;
    }
    visitMdastTextNodes(child, language);
    rebuilt.push(child);
  }
  node.children = rebuilt;
}

/** Wraps rule references (`rule 540`, `603.7`, `CR 116`) in links to their anchors. */
export const remarkLinkifyRuleReferences =
  (language: RuleLanguage = "en") =>
  (tree: MdNode) => {
    visitMdastTextNodes(tree, language);
  };

const PENALTY_KEYS: Readonly<Record<string, string>> = {
  Warning: "Warning",
  Warnings: "Warnings",
  "Game Loss": "Game Loss",
  "No Penalty": "No Penalty",
  "Match Loss": "Match Loss",
  Disqualification: "Disqualification",
  Avertissement: "Warning",
  Avertissements: "Warnings",
  "Perte de partie": "Game Loss",
  "Pas de sanction": "No Penalty",
  "Perte de match": "Match Loss",
  경고: "Warning",
  "게임 패배": "Game Loss",
  "페널티 없음": "No Penalty",
  "경기 패배": "Match Loss",
  실격: "Disqualification",
};

export function penaltyKey(label: string): string | undefined {
  return PENALTY_KEYS[label];
}

const PENALTY_LABELS = Object.keys(PENALTY_KEYS)
  .toSorted((a, b) => b.length - a.length)
  .join("|");

export const PENALTY_REGEX = new RegExp(String.raw`\[(?<penalty>${PENALTY_LABELS})\]`, "gu");

// IPG-style sources often italicize the label, e.g. `[*Warnings*]`; strip the
// inner emphasis markers so the regex above sees a clean `[Label]` token.
const PENALTY_NORMALIZE_REGEX = new RegExp(
  String.raw`\[\s*[*_]*\s*(?<penalty>${PENALTY_LABELS})\s*[*_]*\s*\]`,
  "gu",
);

function splitTextOnPenalties(text: string): HastNode[] {
  const result: HastNode[] = [];
  let last = 0;
  PENALTY_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = PENALTY_REGEX.exec(text);
  while (match !== null) {
    if (match.index > last) {
      result.push({ type: "text", value: text.slice(last, match.index) });
    }
    result.push({
      type: "element",
      tagName: "span",
      properties: { "data-penalty": penaltyKey(match[1] ?? "") },
      children: [{ type: "text", value: match[0] }],
    });
    last = match.index + match[0].length;
    match = PENALTY_REGEX.exec(text);
  }
  if (last < text.length) {
    result.push({ type: "text", value: text.slice(last) });
  }
  return result;
}

function visitHastTextNodes(node: HastNode): void {
  if (node.tagName === "a") {
    // Don't restyle text inside an existing link.
    return;
  }
  if (!node.children) {
    return;
  }
  const rebuilt: HastNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string") {
      if (!PENALTY_REGEX.test(child.value)) {
        PENALTY_REGEX.lastIndex = 0;
        rebuilt.push(child);
        continue;
      }
      PENALTY_REGEX.lastIndex = 0;
      rebuilt.push(...splitTextOnPenalties(child.value));
      continue;
    }
    visitHastTextNodes(child);
    rebuilt.push(child);
  }
  node.children = rebuilt;
}

export interface KeywordBadge {
  name: string;
  color: string;
  darkText: boolean;
}

const BRACKETED_REGEX = /\[(?<label>[^[\]]{1,40})\]/gu;
const KEYWORD_AMOUNT_REGEX = /\s+\d+$/u;

function splitTextOnKeywords(
  text: string,
  keywords: ReadonlyMap<string, KeywordBadge>,
): HastNode[] | null {
  const matches = [...text.matchAll(BRACKETED_REGEX)];
  const result: HastNode[] = [];
  let last = 0;
  for (const [index, match] of matches.entries()) {
    const label = match.groups?.label ?? "";
    const keyword = keywords.get(label.replace(KEYWORD_AMOUNT_REGEX, "").toLowerCase());
    if (keyword === undefined) {
      continue;
    }
    const end = match.index + match[0].length;
    const previous = matches[index - 1];
    const next = matches[index + 1];
    const pointedLeft =
      previous?.groups?.label === ">>" &&
      previous.index + previous[0].length === match.index &&
      previous.index >= last;
    const pointedRight = next?.groups?.label === ">" && next.index === end;
    const start = pointedLeft ? previous.index : match.index;
    if (start > last) {
      result.push({ type: "text", value: text.slice(last, start) });
    }
    result.push({
      type: "element",
      tagName: "span",
      properties: {
        "data-keyword": keyword.name,
        "data-keyword-color": keyword.color,
        "data-keyword-dark": keyword.darkText,
        "data-keyword-point": pointedLeft
          ? pointedRight
            ? "both"
            : "left"
          : pointedRight
            ? "right"
            : undefined,
      },
      children: [{ type: "text", value: label }],
    });
    last = pointedRight ? next.index + next[0].length : end;
  }
  if (result.length === 0) {
    return null;
  }
  if (last < text.length) {
    result.push({ type: "text", value: text.slice(last) });
  }
  return result;
}

function visitHastForKeywords(node: HastNode, keywords: ReadonlyMap<string, KeywordBadge>): void {
  if (node.tagName === "a" || node.properties?.["data-penalty"] !== undefined || !node.children) {
    return;
  }
  const rebuilt: HastNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string") {
      rebuilt.push(...(splitTextOnKeywords(child.value, keywords) ?? [child]));
      continue;
    }
    visitHastForKeywords(child, keywords);
    rebuilt.push(child);
  }
  node.children = rebuilt;
}

export const rehypeKeywordBadges =
  (keywords: ReadonlyMap<string, KeywordBadge>) => (tree: HastNode) => {
    if (keywords.size > 0) {
      visitHastForKeywords(tree, keywords);
    }
  };

export const RULE_GLYPHS: Readonly<Record<string, string>> = {
  E: "exhaust",
  T: "exhaust",
  M: "might",
  S: "might",
  A: "rune-rainbow",
  R: "rune-fury",
  G: "rune-calm",
  B: "rune-mind",
  O: "rune-body",
  P: "rune-chaos",
  Y: "rune-order",
};

const GLYPH_REGEX = /\[(?:(?<energy>\d{1,2})|(?<letter>[ETMSARGBOPY]))\]/gu;

function splitTextOnGlyphs(text: string, yIsVariable: boolean): HastNode[] | null {
  const result: HastNode[] = [];
  let last = 0;
  for (const match of text.matchAll(GLYPH_REGEX)) {
    const energy = match.groups?.energy;
    const letter = match.groups?.letter;
    if (letter === "Y" && yIsVariable) {
      continue;
    }
    if (match.index > last) {
      result.push({ type: "text", value: text.slice(last, match.index) });
    }
    result.push({
      type: "element",
      tagName: "span",
      properties: { "data-glyph": energy === undefined ? RULE_GLYPHS[letter ?? ""] : "energy" },
      children: [{ type: "text", value: energy ?? match[0] }],
    });
    last = match.index + match[0].length;
  }
  if (result.length === 0) {
    return null;
  }
  if (last < text.length) {
    result.push({ type: "text", value: text.slice(last) });
  }
  return result;
}

function visitHastForGlyphs(node: HastNode, yIsVariable: boolean): void {
  if (
    node.properties?.["data-penalty"] !== undefined ||
    node.properties?.["data-keyword"] !== undefined ||
    !node.children
  ) {
    return;
  }
  const rebuilt: HastNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string") {
      rebuilt.push(...(splitTextOnGlyphs(child.value, yIsVariable) ?? [child]));
      continue;
    }
    visitHastForGlyphs(child, yIsVariable);
    rebuilt.push(child);
  }
  node.children = rebuilt;
}

// [Y] is both the Order abbreviation and the variable paired with [X] ("Replace [X] with [Y]");
// a rule that mentions [X] or opens with [Y] is using the variable.
export function ruleUsesYVariable(source: string): boolean {
  return source.includes("[X]") || source.trimStart().startsWith("[Y]");
}

export const rehypeRuleGlyphs = (yIsVariable: boolean) => (tree: HastNode) => {
  visitHastForGlyphs(tree, yIsVariable);
};

/** Wraps `[Warning]`-style penalty labels in `<span data-penalty>` elements. */
export const rehypeHighlightPenalties = () => (tree: HastNode) => {
  visitHastTextNodes(tree);
};

// French cites the Core Rules as "section 110. des Règles de base", with emphasis
// often splitting the phrase, so it is linked in the source before parsing.
const FRENCH_CORE_REFERENCE_REGEX =
  /(?<lead>\b(?:section|point)\s+\*?)(?<number>\d+(?:\.\d+)*(?:\.[a-z](?:\.\d+)?)?)(?=\.?\*?\s+des\s+\*?Règles de base)/gu;

/**
 * Collapses italicized penalty labels to plain `[Label]` tokens and turns
 * every newline into a markdown hard break.
 */
export function preprocessRuleMarkdown(content: string, language: RuleLanguage = "en"): string {
  const linked =
    language === "fr"
      ? content.replaceAll(
          FRENCH_CORE_REFERENCE_REGEX,
          (_match, lead: string, number: string) =>
            `${lead}[${number}](/rules/core?lang=fr#rule-${number})`,
        )
      : content;
  return linked.replaceAll(PENALTY_NORMALIZE_REGEX, "[$<penalty>]").replaceAll("\n", "  \n");
}

const TERM_TRAILING_PUNCT_REGEX = /\s*[.,:;]+$/u;
const FRENCH_ARTICLE_REGEX = /^(?:le|la|les|l['’])\s*/u;
// Strip a possessive 's (straight or curly apostrophe) so "*Card's*" resolves
// to the "Card" anchor.
const TERM_POSSESSIVE_REGEX = /['‘’]s$/u;

export interface TermLinkContext {
  anchors: ReadonlyMap<string, string>;
  currentRuleNumber?: string;
}

function visitEmphasisForTerms(node: MdNode, context: TermLinkContext): void {
  if (!node.children) {
    return;
  }
  for (const [index, child] of node.children.entries()) {
    if (child.type === "link") {
      continue;
    }
    if (child.type === "emphasis" && child.children?.length === 1) {
      const inner = child.children[0];
      if (inner?.type === "text" && typeof inner.value === "string") {
        const stripped = inner.value
          .trim()
          .replace(TERM_TRAILING_PUNCT_REGEX, "")
          .replace(TERM_POSSESSIVE_REGEX, "");
        const key = stripped.toLowerCase();
        const target =
          context.anchors.get(key) ?? context.anchors.get(key.replace(FRENCH_ARTICLE_REGEX, ""));
        if (target && target !== context.currentRuleNumber) {
          node.children[index] = {
            type: "link",
            url: `#rule-${target}`,
            children: [child],
          };
          continue;
        }
      }
    }
    visitEmphasisForTerms(child, context);
  }
}

export function makeRemarkLinkifyTerms(context: TermLinkContext) {
  return () => (tree: MdNode) => {
    if (context.anchors.size === 0) {
      return;
    }
    visitEmphasisForTerms(tree, context);
  };
}
