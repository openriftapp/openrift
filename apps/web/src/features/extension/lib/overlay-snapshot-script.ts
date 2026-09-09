import type { CardmarketOverlaySnapshot } from "@openrift/shared/contracts/cardmarket-overlay";

/** `<` is escaped so a list name can never close the script element. JSON.parse restores it. */
export function serializeOverlaySnapshot(snapshot: CardmarketOverlaySnapshot): string {
  // oxlint-disable-next-line unicorn/prefer-string-raw -- the suggested String.raw rewrite interprets \uXXXX as literal code points, defeating the escape.
  return JSON.stringify(snapshot).replaceAll("<", "\\u003c");
}
