import type { RuleRef } from "@openrift/shared/board-state";
import { CAPTION_REF_PATTERN, captionRefFromMatch } from "@openrift/shared/board-state";

export type CaptionSegment =
  | { type: "text"; text: string }
  | { type: "rule"; ref: RuleRef }
  | { type: "card"; pieceId: string };

export function splitCaption(text: string): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(CAPTION_REF_PATTERN)) {
    const ref = captionRefFromMatch(match);
    if (!ref) {
      continue;
    }
    if (match.index > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, match.index) });
    }
    segments.push(
      ref.kind === "rule" ? { type: "rule", ref: ref.ref } : { type: "card", pieceId: ref.pieceId },
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ type: "text", text: text.slice(cursor) });
  }
  return segments;
}
