import type { CardmarketOverlaySnapshot } from "@openrift/shared/contracts/cardmarket-overlay";

/** `<` is escaped so a list name can never close the script element. JSON.parse restores it. */
export function serializeOverlaySnapshot(snapshot: CardmarketOverlaySnapshot): string {
  return JSON.stringify(snapshot).replaceAll("<", String.raw`\u003c`);
}
