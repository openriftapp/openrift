import { fromMarkdown } from "mdast-util-from-markdown";
import { toHast } from "mdast-util-to-hast";

import { linkCardMentions, splitRuleSections } from "./rule-examples.js";
import type { HastNode, MdNode } from "./rules-markdown.js";
import {
  makeRemarkLinkifyTerms,
  preprocessRuleMarkdown,
  rehypeHighlightPenalties,
  remarkLinkifyRuleReferences,
} from "./rules-markdown.js";

export interface CardMentions {
  pattern: RegExp;
  slugsByName: ReadonlyMap<string, string>;
}

export interface RuleHtmlOptions {
  termAnchors: ReadonlyMap<string, string>;
  ruleNumber: string;
  cardMentions?: CardMentions;
}

const FORMATTING_TAGS = new Set(["em", "strong", "code"]);
const NO_BLOCK_TAGS: ReadonlySet<string> = new Set();
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
const PENALTIES = new Set([
  "Warning",
  "Warnings",
  "Game Loss",
  "No Penalty",
  "Match Loss",
  "Disqualification",
]);
const SAFE_HREF_REGEX =
  /^(?:#rule-[\w.-]+|\/rules\/(?:core|tournament)#rule-[\w.-]+|\/cards\/[a-z0-9-]+|https:\/\/[^\s"'<>]+)$/u;

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
    return `<a href="${escapeHtml(href)}"${external}>${inner}</a>`;
  }
  if (node.tagName === "span") {
    const penalty = node.properties?.["data-penalty"];
    if (typeof penalty === "string" && PENALTIES.has(penalty)) {
      return `<span data-penalty="${escapeHtml(penalty)}">${inner}</span>`;
    }
  }
  return inner;
}

function renderInline(source: string, options: RuleHtmlOptions): string {
  const tree = fromMarkdown(preprocessRuleMarkdown(source)) as unknown as MdNode;
  remarkLinkifyRuleReferences()(tree);
  makeRemarkLinkifyTerms({ anchors: options.termAnchors, currentRuleNumber: options.ruleNumber })()(
    tree,
  );
  const hast = toHast(tree as Parameters<typeof toHast>[0]) as unknown as HastNode;
  rehypeHighlightPenalties()(hast);
  return serialize(hast, NO_BLOCK_TAGS);
}

export function renderCommentHtml(markdown: string): string {
  const tree = fromMarkdown(markdown);
  return serialize(toHast(tree) as unknown as HastNode, COMMENT_BLOCK_TAGS);
}

export function renderRuleHtml(content: string, options: RuleHtmlOptions): string {
  const sections = splitRuleSections(content);
  if (!sections.some((section) => section.kind === "example")) {
    return renderInline(content, options);
  }
  return sections
    .map((section) => {
      if (section.kind === "text") {
        return `<div>${renderInline(section.content, options)}</div>`;
      }
      const linked = options.cardMentions
        ? linkCardMentions(
            section.content,
            options.cardMentions.pattern,
            options.cardMentions.slugsByName,
          )
        : section.content;
      return `<div class="rule-example">${renderInline(linked, options)}</div>`;
    })
    .join("");
}
