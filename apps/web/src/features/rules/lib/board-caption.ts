import type { RuleRef } from "@openrift/shared/board-state";
import { RULE_REF_PATTERN, ruleRefFromMatch } from "@openrift/shared/board-state";

export type CaptionSegment = { type: "text"; text: string } | { type: "rule"; ref: RuleRef };

export function splitCaption(text: string): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(RULE_REF_PATTERN)) {
    const ref = ruleRefFromMatch(match);
    if (!ref) {
      continue;
    }
    if (match.index > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, match.index) });
    }
    segments.push({ type: "rule", ref });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ type: "text", text: text.slice(cursor) });
  }
  return segments;
}
