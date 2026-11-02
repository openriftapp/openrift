import type { QueryNode, SearchSpan } from "./parse.js";

function leafSpan(node: QueryNode): SearchSpan {
  switch (node.kind) {
    case "and":
    case "or": {
      const spans = node.children.map((child) => leafSpan(child));
      return {
        start: Math.min(...spans.map((span) => span.start)),
        end: Math.max(...spans.map((span) => span.end)),
      };
    }
    case "not": {
      return leafSpan(node.child);
    }
    default: {
      return node.span;
    }
  }
}

export function searchTermSpan(node: QueryNode, terms: readonly SearchSpan[]): SearchSpan {
  let { start, end } = leafSpan(node);
  for (const term of terms) {
    if (term.start < end && start < term.end) {
      start = Math.min(start, term.start);
      end = Math.max(end, term.end);
    }
  }
  return { start, end };
}

const TRAILING_OR = /(?:^|(?<=[\s(]))or$/iu;
const LEADING_OR = /^or(?=$|[\s()])/iu;

function joinParts(before: string, after: string): string {
  if (before === "" || after === "") {
    return before + after;
  }
  const joiner = before.endsWith("(") || after.startsWith(")") ? "" : " ";
  return `${before}${joiner}${after}`;
}

/**
 * Cuts `span` and any `-` directly before it out of `raw`, joining the rest with one space.
 * An `or` left joining nothing goes with it, and so do brackets left empty.
 */
export function removeSearchSpan(raw: string, span: SearchSpan): string {
  let start = span.start;
  while (start > 0 && raw[start - 1] === "-") {
    start -= 1;
  }
  let before = raw.slice(0, start).trimEnd();
  let after = raw.slice(span.end).trimStart();
  const orBefore = TRAILING_OR.test(before) && !/^$|\($/u.test(before.slice(0, -2).trimEnd());
  const orAfter = LEADING_OR.test(after);
  const openBefore = before === "" || before.endsWith("(");
  const closeAfter = after === "" || after.startsWith(")");
  if (orBefore && (orAfter || closeAfter)) {
    before = before.slice(0, -2).trimEnd();
  } else if (orAfter && openBefore) {
    after = after.slice(2).trimStart();
  }
  while (before.endsWith("(") && after.startsWith(")")) {
    before = before.slice(0, -1).replace(/-+$/u, "").trimEnd();
    after = after.slice(1).trimStart();
  }
  return joinParts(before, after);
}
