import { RULE_REFERENCE_REGEX } from "./rules.js";

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

function splitTextOnRuleReferences(text: string): MdNode[] {
  const result: MdNode[] = [];
  let last = 0;
  RULE_REFERENCE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = RULE_REFERENCE_REGEX.exec(text);
  while (match !== null) {
    if (match.index > last) {
      result.push({ type: "text", value: text.slice(last, match.index) });
    }
    const keyword = match[1];
    const ruleNumber = match[2] ?? match[3];
    const url = keyword === "CR" ? `/rules/core#rule-${ruleNumber}` : `#rule-${ruleNumber}`;
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

function visitMdastTextNodes(node: MdNode): void {
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
      const replacements = splitTextOnRuleReferences(child.value);
      const [only] = replacements;
      const isUnchanged =
        replacements.length === 1 && only?.type === "text" && only.value === child.value;
      rebuilt.push(...(isUnchanged ? [child] : replacements));
      continue;
    }
    visitMdastTextNodes(child);
    rebuilt.push(child);
  }
  node.children = rebuilt;
}

/** Wraps rule references (`rule 540`, `603.7`, `CR 116`) in links to their anchors. */
export const remarkLinkifyRuleReferences = () => (tree: MdNode) => {
  visitMdastTextNodes(tree);
};

export const PENALTY_REGEX =
  /\[(?<penalty>Warnings?|Game Loss|No Penalty|Match Loss|Disqualification)\]/gu;

// IPG-style sources often italicize the label, e.g. `[*Warnings*]`; strip the
// inner emphasis markers so the regex above sees a clean `[Label]` token.
const PENALTY_NORMALIZE_REGEX =
  /\[\s*[*_]*\s*(?<penalty>Warnings?|Game Loss|No Penalty|Match Loss|Disqualification)\s*[*_]*\s*\]/gu;

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
      properties: { "data-penalty": match[1] },
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

/** Wraps `[Warning]`-style penalty labels in `<span data-penalty>` elements. */
export const rehypeHighlightPenalties = () => (tree: HastNode) => {
  visitHastTextNodes(tree);
};

/**
 * Collapses italicized penalty labels to plain `[Label]` tokens and turns
 * every newline into a markdown hard break.
 */
export function preprocessRuleMarkdown(content: string): string {
  return content.replaceAll(PENALTY_NORMALIZE_REGEX, "[$<penalty>]").replaceAll("\n", "  \n");
}

const TERM_TRAILING_PUNCT_REGEX = /[.,:;]+$/u;
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
        const target = context.anchors.get(stripped.toLowerCase());
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
