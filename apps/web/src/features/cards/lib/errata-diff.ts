import type { CardTextToken } from "@openrift/shared/card-text";
import { tokenizeCardText } from "@openrift/shared/card-text";

import { lcsDiff } from "@/lib/text-diff";

type ErrataDiffStatus = "same" | "added" | "removed";

export interface ErrataDiffSegment {
  status: ErrataDiffStatus;
  italic: boolean;
  tokens: CardTextToken[];
}

interface Atom {
  key: string;
  italic: boolean;
  token: CardTextToken;
}

const WORD_PATTERN = /\s+|[\p{L}\p{N}’'-]+|[^\s\p{L}\p{N}’'-]/gu;

function textAtoms(value: string, italic: boolean): Atom[] {
  return [...value.matchAll(WORD_PATTERN)].map((match) => ({
    key: `t:${match[0]}`,
    italic,
    token: { type: "text", value: match[0] },
  }));
}

function keywordKey(token: Extract<CardTextToken, { type: "keyword" }>): string {
  return `k:${token.name}:${token.pointedLeft ? "<" : ""}${token.pointedRight ? ">" : ""}:${JSON.stringify(token.children)}`;
}

function flatten(tokens: CardTextToken[], italic: boolean): Atom[] {
  return tokens.flatMap((token): Atom[] => {
    switch (token.type) {
      case "text": {
        return textAtoms(token.value, italic);
      }
      case "glyph": {
        return [{ key: `g:${token.name}`, italic, token }];
      }
      case "keyword": {
        return [{ key: keywordKey(token), italic, token }];
      }
      case "newline": {
        return [{ key: "n", italic: false, token }];
      }
      case "italic": {
        return flatten(token.children, true);
      }
      case "paren": {
        return [...textAtoms("(", true), ...flatten(token.children, true), ...textAtoms(")", true)];
      }
      default: {
        return [];
      }
    }
  });
}

interface DiffedAtom {
  atom: Atom;
  status: ErrataDiffStatus;
}

// Reversed in and out to keep front-to-back tie-breaking (additions before removals).
function diffAtoms(before: Atom[], after: Atom[]): DiffedAtom[] {
  return lcsDiff(before.toReversed(), after.toReversed(), (atom) => atom.key)
    .toReversed()
    .map(({ type, item }) => ({ atom: item, status: type === "equal" ? "same" : type }));
}

function isBlankAtom(atom: Atom): boolean {
  return atom.token.type === "text" && atom.token.value.trim() === "";
}

export function diffCardText(printed: string, corrected: string): ErrataDiffSegment[] {
  const diffed = diffAtoms(
    flatten(tokenizeCardText(printed), false),
    flatten(tokenizeCardText(corrected), false),
  );

  const ordered: DiffedAtom[] = [];
  let run: DiffedAtom[] = [];
  const flushRun = () => {
    const first = run.findIndex((entry) => entry.status !== "same");
    if (first === -1) {
      ordered.push(...run);
      run = [];
      return;
    }
    const last = run.findLastIndex((entry) => entry.status !== "same");
    const change = run.slice(first, last + 1);
    ordered.push(
      ...run.slice(0, first),
      ...change
        .filter((entry) => entry.status !== "added")
        .map((entry) => ({ ...entry, status: "removed" as const })),
      ...change
        .filter((entry) => entry.status !== "removed")
        .map((entry) => ({ ...entry, status: "added" as const })),
      ...run.slice(last + 1),
    );
    run = [];
  };
  for (const entry of diffed) {
    if (entry.status === "same" && !isBlankAtom(entry.atom)) {
      flushRun();
      ordered.push(entry);
    } else {
      run.push(entry);
    }
  }
  flushRun();

  const segments: ErrataDiffSegment[] = [];
  for (const { atom, status } of ordered) {
    const last = segments.at(-1);
    const lastToken = last?.tokens.at(-1);
    if (last && last.status === status && last.italic === atom.italic) {
      if (lastToken?.type === "text" && atom.token.type === "text") {
        last.tokens[last.tokens.length - 1] = {
          type: "text",
          value: lastToken.value + atom.token.value,
        };
      } else {
        last.tokens.push(atom.token);
      }
    } else {
      segments.push({ status, italic: atom.italic, tokens: [atom.token] });
    }
  }
  return segments.flatMap((segment) => peelEdgeWhitespace(segment));
}

function textSegment(value: string, italic: boolean): ErrataDiffSegment {
  return { status: "same", italic, tokens: [{ type: "text", value }] };
}

function peelEdgeWhitespace(segment: ErrataDiffSegment): ErrataDiffSegment[] {
  if (segment.status === "same" || isBlankSegment(segment)) {
    return [segment];
  }
  const tokens = [...segment.tokens];
  const first = tokens[0];
  const lead = first?.type === "text" ? (/^\s+/u.exec(first.value)?.[0] ?? "") : "";
  if (lead !== "" && first?.type === "text") {
    tokens[0] = { type: "text", value: first.value.slice(lead.length) };
  }
  const last = tokens.at(-1);
  const trail = last?.type === "text" ? (/\s+$/u.exec(last.value)?.[0] ?? "") : "";
  if (trail !== "" && last?.type === "text") {
    tokens[tokens.length - 1] = { type: "text", value: last.value.slice(0, -trail.length) };
  }
  return [
    ...(lead === "" ? [] : [textSegment(lead, segment.italic)]),
    { ...segment, tokens },
    ...(trail === "" ? [] : [textSegment(trail, segment.italic)]),
  ];
}

export function isBlankSegment(segment: ErrataDiffSegment): boolean {
  return segment.tokens.every((token) => token.type === "text" && token.value.trim() === "");
}

export function diffSide(
  segments: readonly ErrataDiffSegment[],
  side: "printed" | "corrected",
): ErrataDiffSegment[] {
  const hidden: ErrataDiffStatus = side === "printed" ? "added" : "removed";
  return segments.filter((segment) => segment.status !== hidden);
}
