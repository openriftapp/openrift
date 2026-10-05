import type { HastNode, MdNode } from "@openrift/shared/rules-markdown";
import {
  PENALTY_REGEX,
  penaltyKey,
  preprocessRuleMarkdown,
  remarkLinkifyRuleReferences,
} from "@openrift/shared/rules-markdown";
import type { RuleLanguage } from "@openrift/shared/types/api/rules";
import { fromMarkdown } from "mdast-util-from-markdown";

import { lcsDiff } from "@/lib/text-diff";

// Diffing raw markdown source is unsafe: interleaving the emphasis markers of
// two versions can pair them up differently than in either version. Instead
// both versions are parsed, flattened to word tokens carrying their
// formatting context, diffed by text only, then rebuilt into a merged tree.

interface InlineFrame {
  tag: "em" | "strong" | "code" | "a" | "penalty" | "diff";
  href?: string;
  penalty?: string;
  diff?: "added" | "removed";
}

interface WsAtom {
  hardBreak: boolean;
  value: string;
}

interface InlineToken {
  text: string;
  pre: WsAtom[];
  frames: InlineFrame[];
}

const WORD_OR_WS_REGEX = /(?<ws>\s+)|(?<word>\w+)|(?<punct>[^\w\s]+)/gu;

const BLOCK_TYPES = new Set(["paragraph", "heading", "list", "listItem", "blockquote"]);

interface FlattenState {
  tokens: InlineToken[];
  pendingWs: WsAtom[];
}

function pushTextTokens(text: string, frames: InlineFrame[], state: FlattenState): void {
  WORD_OR_WS_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = WORD_OR_WS_REGEX.exec(text);
  while (match !== null) {
    const ws = match.groups?.ws;
    if (ws === undefined) {
      state.tokens.push({ text: match[0], pre: state.pendingWs, frames });
      state.pendingWs = [];
    } else {
      state.pendingWs.push({ hardBreak: false, value: ws });
    }
    match = WORD_OR_WS_REGEX.exec(text);
  }
}

function flattenText(text: string, frames: InlineFrame[], state: FlattenState): void {
  // Match penalty labels (e.g. `[Warning]`) as single tokens before word splitting.
  const penaltyRegex = new RegExp(PENALTY_REGEX.source, "gu");
  let last = 0;
  let match: RegExpExecArray | null = penaltyRegex.exec(text);
  while (match !== null) {
    if (match.index > last) {
      pushTextTokens(text.slice(last, match.index), frames, state);
    }
    state.tokens.push({
      text: match[0],
      pre: state.pendingWs,
      frames: [...frames, { tag: "penalty", penalty: penaltyKey(match[1] ?? "") }],
    });
    state.pendingWs = [];
    last = match.index + match[0].length;
    match = penaltyRegex.exec(text);
  }
  if (last < text.length) {
    pushTextTokens(text.slice(last), frames, state);
  }
}

function flattenNode(node: MdNode, frames: InlineFrame[], state: FlattenState): void {
  switch (node.type) {
    case "text": {
      flattenText(node.value ?? "", frames, state);
      return;
    }
    case "inlineCode": {
      state.tokens.push({
        text: node.value ?? "",
        pre: state.pendingWs,
        frames: [...frames, { tag: "code" }],
      });
      state.pendingWs = [];
      return;
    }
    case "break": {
      state.pendingWs.push({ hardBreak: true, value: "" });
      return;
    }
    case "emphasis": {
      flattenChildren(node, [...frames, { tag: "em" }], state);
      return;
    }
    case "strong": {
      flattenChildren(node, [...frames, { tag: "strong" }], state);
      return;
    }
    case "link": {
      flattenChildren(node, [...frames, { tag: "a", href: node.url }], state);
      return;
    }
    default: {
      flattenChildren(node, frames, state);
    }
  }
}

function flattenChildren(node: MdNode, frames: InlineFrame[], state: FlattenState): void {
  let previousWasBlock = false;
  for (const child of node.children ?? []) {
    const isBlock = BLOCK_TYPES.has(child.type);
    if (isBlock && previousWasBlock) {
      state.pendingWs.push({ hardBreak: true, value: "" });
    }
    flattenNode(child, frames, state);
    previousWasBlock = isBlock || previousWasBlock;
  }
}

function flattenTree(tree: MdNode): InlineToken[] {
  const state: FlattenState = { tokens: [], pendingWs: [] };
  flattenChildren(tree, [], state);
  return state.tokens;
}

interface DiffEntry {
  type: "equal" | "added" | "removed";
  token: InlineToken;
}

/**
 * LCS over the token texts only; formatting is ignored, so a word whose
 * emphasis, link, or badge changed but whose text didn't compares equal.
 */
function diffTokens(oldTokens: InlineToken[], newTokens: InlineToken[]): DiffEntry[] {
  return lcsDiff(oldTokens, newTokens, (token) => token.text).map(({ type, item }) => ({
    type,
    token: item,
  }));
}

function frameEquals(a: InlineFrame, b: InlineFrame): boolean {
  return a.tag === b.tag && a.href === b.href && a.penalty === b.penalty && a.diff === b.diff;
}

function frameToElement(frame: InlineFrame): HastNode {
  switch (frame.tag) {
    case "a": {
      return { type: "element", tagName: "a", properties: { href: frame.href }, children: [] };
    }
    case "penalty": {
      return {
        type: "element",
        tagName: "span",
        properties: { "data-penalty": frame.penalty },
        children: [],
      };
    }
    case "diff": {
      return {
        type: "element",
        tagName: "span",
        properties: { "data-diff": frame.diff },
        children: [],
      };
    }
    default: {
      return { type: "element", tagName: frame.tag, properties: {}, children: [] };
    }
  }
}

function appendText(container: HastNode, value: string): void {
  if (!value) {
    return;
  }
  const last = container.children?.at(-1);
  if (last?.type === "text" && typeof last.value === "string") {
    last.value += value;
    return;
  }
  container.children?.push({ type: "text", value });
}

function buildMergedTree(entries: DiffEntry[]): HastNode[] {
  const root: HastNode = { type: "root", children: [] };
  const stack: { frame: InlineFrame; node: HastNode }[] = [];

  const container = () => stack.at(-1)?.node ?? root;

  for (const entry of entries) {
    const frames =
      entry.type === "equal"
        ? entry.token.frames
        : [...entry.token.frames, { tag: "diff", diff: entry.type } satisfies InlineFrame];

    let common = 0;
    for (const [depth, frame] of frames.entries()) {
      const open = stack[depth];
      if (open === undefined || !frameEquals(open.frame, frame)) {
        break;
      }
      common = depth + 1;
    }
    stack.length = common;

    // Whitespace between tokens goes outside the frames being opened/closed,
    // so a space between an italic word and a plain word lands between the
    // elements, and a space between two added words stays inside the mark.
    for (const atom of entry.token.pre) {
      if (atom.hardBreak) {
        container().children?.push({
          type: "element",
          tagName: "br",
          properties: {},
          children: [],
        });
      } else {
        appendText(container(), atom.value);
      }
    }

    for (const frame of frames.slice(common)) {
      const node = frameToElement(frame);
      container().children?.push(node);
      stack.push({ frame, node });
    }

    appendText(container(), entry.token.text);
  }

  return root.children ?? [];
}

function parseRuleMarkdown(source: string, language?: RuleLanguage): MdNode {
  const tree = fromMarkdown(preprocessRuleMarkdown(source, language)) as unknown as MdNode;
  remarkLinkifyRuleReferences(language)(tree);
  return tree;
}

/**
 * Computes an inline word-level diff between two rule bodies as a merged
 * HAST-like tree. Both versions run through the full parse pipeline first,
 * so formatting can't be mangled by the diff.
 */
export function diffRuleMarkdown(
  oldSource: string,
  newSource: string,
  language?: RuleLanguage,
): HastNode[] {
  const newTokens = flattenTree(parseRuleMarkdown(newSource, language));
  if (oldSource === newSource) {
    return buildMergedTree(newTokens.map((token) => ({ type: "equal", token })));
  }
  const oldTokens = flattenTree(parseRuleMarkdown(oldSource, language));
  return buildMergedTree(diffTokens(oldTokens, newTokens));
}

export function diffRuleSide(nodes: HastNode[], side: "old" | "new"): HastNode[] {
  const dropped = side === "old" ? "added" : "removed";
  return nodes.flatMap((node) => {
    if (node.properties?.["data-diff"] === dropped) {
      return [];
    }
    return node.children ? [{ ...node, children: diffRuleSide(node.children, side) }] : [node];
  });
}

/**
 * Whether `diffRuleMarkdown` would render any add/remove marks for this pair.
 * Bodies differing only in whitespace, emphasis, or link markup are silent.
 */
export function hasVisibleRuleChanges(oldSource: string, newSource: string): boolean {
  if (oldSource === newSource) {
    return false;
  }
  const oldTokens = flattenTree(parseRuleMarkdown(oldSource));
  const newTokens = flattenTree(parseRuleMarkdown(newSource));
  if (oldTokens.length !== newTokens.length) {
    return true;
  }
  // Equal-length token sequences with pairwise-equal text are exactly the
  // pairs whose LCS covers everything, i.e. an all-`equal` diff.
  return oldTokens.some((token, index) => token.text !== newTokens[index]?.text);
}
