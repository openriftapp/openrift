import { fromMarkdown } from "mdast-util-from-markdown";
import { toHast } from "mdast-util-to-hast";

import { linkCardMentions, splitRuleSections } from "./rule-examples.js";
import type { HastNode, KeywordBadge, MdNode } from "./rules-markdown.js";
import {
  makeRemarkLinkifyTerms,
  penaltyKey,
  preprocessRuleMarkdown,
  rehypeHighlightPenalties,
  rehypeKeywordBadges,
  rehypeRuleGlyphs,
  remarkLinkifyRuleReferences,
  RULE_GLYPHS,
  ruleUsesYVariable,
} from "./rules-markdown.js";
import type { RuleLanguage } from "./types/api/rules.js";

export interface CardMentions {
  pattern: RegExp;
  slugsByName: ReadonlyMap<string, string>;
  imagesBySlug?: ReadonlyMap<string, { imageId: string; landscape: boolean }>;
}

export interface RuleHtmlOptions {
  language?: RuleLanguage;
  termAnchors: ReadonlyMap<string, string>;
  ruleNumber: string;
  cardMentions?: CardMentions;
  keywords?: ReadonlyMap<string, KeywordBadge>;
}

const FORMATTING_TAGS = new Set(["em", "strong", "code"]);
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/iu;
const KEYWORD_POINTS = new Set(["left", "right", "both"]);
const GLYPH_NAMES: ReadonlySet<string> = new Set([...Object.values(RULE_GLYPHS), "energy"]);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const CARD_HREF_PREFIX = "/cards/";

function addCardImages(
  node: HastNode,
  imagesBySlug: ReadonlyMap<string, { imageId: string; landscape: boolean }>,
): void {
  const href = node.properties?.href;
  if (node.tagName === "a" && typeof href === "string" && href.startsWith(CARD_HREF_PREFIX)) {
    const image = imagesBySlug.get(href.slice(CARD_HREF_PREFIX.length));
    if (image !== undefined) {
      node.properties = {
        ...node.properties,
        "data-card-image": image.imageId,
        "data-card-landscape": image.landscape,
      };
    }
    return;
  }
  for (const child of node.children ?? []) {
    addCardImages(child, imagesBySlug);
  }
}
const NO_BLOCK_TAGS: ReadonlySet<string> = new Set();
const NO_KEYWORDS: ReadonlyMap<string, KeywordBadge> = new Map();
const COMMENT_BLOCK_TAGS: ReadonlySet<string> = new Set([
  "p",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "blockquote",
]);
const SAFE_HREF_REGEX =
  /^(?:#rule-[\w.-]+|\/rules\/(?:core|tournament)(?:\?lang=[A-Za-z-]+)?#rule-[\w.-]+|\/cards\/[a-z0-9-]+|https:\/\/[^\s"'<>]+)$/u;

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Allowlist serializer: any element or attribute not named here is dropped, and raw HTML never passes.
function serialize(node: HastNode, blockTags: ReadonlySet<string>): string {
  if (node.type === "text") {
    return escapeHtml(node.value ?? "");
  }
  if (node.type !== "element" && node.type !== "root") {
    return "";
  }
  const inner = (node.children ?? []).map((child) => serialize(child, blockTags)).join("");
  if (node.type === "root" || node.tagName === undefined) {
    return inner;
  }
  if (node.tagName === "br") {
    return "<br>";
  }
  if (node.tagName === "hr" && blockTags.size > 0) {
    return "<hr>";
  }
  if (FORMATTING_TAGS.has(node.tagName) || blockTags.has(node.tagName)) {
    return `<${node.tagName}>${inner}</${node.tagName}>`;
  }
  if (node.tagName === "a") {
    const href = node.properties?.href;
    if (typeof href !== "string" || !SAFE_HREF_REGEX.test(href)) {
      return inner;
    }
    const external = href.startsWith("https://") ? ' target="_blank" rel="noreferrer"' : "";
    const cardImage = node.properties?.["data-card-image"];
    const preview =
      typeof cardImage === "string" && UUID_REGEX.test(cardImage)
        ? ` data-card-image="${cardImage}"${node.properties?.["data-card-landscape"] === true ? " data-card-landscape" : ""}`
        : "";
    return `<a href="${escapeHtml(href)}"${external}${preview}>${inner}</a>`;
  }
  if (node.tagName === "span") {
    const penalty = node.properties?.["data-penalty"];
    if (typeof penalty === "string" && penaltyKey(penalty) === penalty) {
      return `<span data-penalty="${escapeHtml(penalty)}">${inner}</span>`;
    }
    const keyword = node.properties?.["data-keyword"];
    const color = node.properties?.["data-keyword-color"];
    if (typeof keyword === "string" && typeof color === "string" && HEX_COLOR_REGEX.test(color)) {
      const dark = node.properties?.["data-keyword-dark"] === true ? " data-keyword-dark" : "";
      const point = node.properties?.["data-keyword-point"];
      const pointAttribute =
        typeof point === "string" && KEYWORD_POINTS.has(point)
          ? ` data-keyword-point="${point}"`
          : "";
      return `<span data-keyword="${escapeHtml(keyword)}" style="--keyword-color:${color}"${dark}${pointAttribute}>${inner}</span>`;
    }
    const glyph = node.properties?.["data-glyph"];
    if (typeof glyph === "string" && GLYPH_NAMES.has(glyph)) {
      return `<span data-glyph="${glyph}">${inner}</span>`;
    }
  }
  return inner;
}

function renderInline(source: string, options: RuleHtmlOptions, yIsVariable: boolean): string {
  const tree = fromMarkdown(preprocessRuleMarkdown(source, options.language)) as unknown as MdNode;
  remarkLinkifyRuleReferences(options.language)(tree);
  makeRemarkLinkifyTerms({ anchors: options.termAnchors, currentRuleNumber: options.ruleNumber })()(
    tree,
  );
  const hast = toHast(tree as Parameters<typeof toHast>[0]) as unknown as HastNode;
  rehypeHighlightPenalties()(hast);
  rehypeKeywordBadges(options.keywords ?? NO_KEYWORDS)(hast);
  rehypeRuleGlyphs(yIsVariable)(hast);
  if (options.cardMentions?.imagesBySlug) {
    addCardImages(hast, options.cardMentions.imagesBySlug);
  }
  return serialize(hast, NO_BLOCK_TAGS);
}

export function renderCommentHtml(markdown: string): string {
  const tree = fromMarkdown(markdown);
  return serialize(toHast(tree) as unknown as HastNode, COMMENT_BLOCK_TAGS);
}

export function renderRuleHtml(content: string, options: RuleHtmlOptions): string {
  const sections = splitRuleSections(content, options.language);
  const yIsVariable = ruleUsesYVariable(content);
  if (!sections.some((section) => section.kind === "example")) {
    return renderInline(content, options, yIsVariable);
  }
  return sections
    .map((section) => {
      if (section.kind === "text") {
        return `<div>${renderInline(section.content, options, yIsVariable)}</div>`;
      }
      const linked = options.cardMentions
        ? linkCardMentions(
            section.content,
            options.cardMentions.pattern,
            options.cardMentions.slugsByName,
          )
        : section.content;
      return `<div class="rule-example">${renderInline(linked, options, yIsVariable)}</div>`;
    })
    .join("");
}
