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

/** Cuts `span` and any `-` directly before it out of `raw`, joining the rest with one space. */
export function removeSearchSpan(raw: string, span: SearchSpan): string {
  let start = span.start;
  while (start > 0 && raw[start - 1] === "-") {
    start -= 1;
  }
  const before = raw.slice(0, start).trimEnd();
  const after = raw.slice(span.end).trimStart();
  if (before === "" || after === "") {
    return before + after;
  }
  const joiner = before.endsWith("(") || after.startsWith(")") ? "" : " ";
  return `${before}${joiner}${after}`;
}
