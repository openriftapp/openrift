import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";

export function DeckCountMark() {
  return (
    // z-20 lifts the frame over the image shell's z-10 edge layer.
    <div
      aria-hidden
      className="ring-primary pointer-events-none absolute inset-0 z-20 ring-3 ring-inset"
      style={{ borderRadius: CARD_BORDER_RADIUS }}
    />
  );
}
