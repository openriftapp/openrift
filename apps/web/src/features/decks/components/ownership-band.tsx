import type { OwnershipBandSegments } from "@/features/decks/lib/deck-ownership-band";
import { ownershipBandTitle } from "@/features/decks/lib/deck-ownership-band";

/** Sits along the bottom edge of a `relative` card thumbnail; the missing share stays a gap. */
export function OwnershipBand({
  quantity,
  band,
}: {
  quantity: number;
  band: OwnershipBandSegments;
}) {
  return (
    <span
      title={ownershipBandTitle(quantity, band)}
      style={{
        borderBottomLeftRadius: "5% 100%",
        borderBottomRightRadius: "5% 100%",
      }}
      className="absolute inset-x-0 bottom-0 flex h-0.5 overflow-hidden"
    >
      {band.exact > 0 && (
        <span className="bg-success" style={{ flexGrow: band.exact, flexBasis: 0 }} />
      )}
      {band.other > 0 && (
        <span className="bg-info" style={{ flexGrow: band.other, flexBasis: 0 }} />
      )}
      {band.borrowed > 0 && (
        <span className="bg-violet" style={{ flexGrow: band.borrowed, flexBasis: 0 }} />
      )}
      {band.locked > 0 && (
        <span className="bg-warning" style={{ flexGrow: band.locked, flexBasis: 0 }} />
      )}
      {band.missing > 0 && <span style={{ flexGrow: band.missing, flexBasis: 0 }} />}
    </span>
  );
}
