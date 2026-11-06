import type { OwnershipBandSegments } from "@/features/decks/lib/deck-ownership-band";
import { ownershipBandTitle } from "@/features/decks/lib/deck-ownership-band";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

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

const LABELED_SEGMENTS = [
  {
    key: "exact",
    className: "bg-success/20 text-success",
    label: () => m.decks_overview_own_owned(),
  },
  {
    key: "other",
    className: "bg-info/20 text-info",
    label: () => m.decks_overview_own_other_printing(),
  },
  {
    key: "borrowed",
    className: "bg-violet/20 text-violet",
    label: () => m.decks_overview_own_borrowed(),
  },
  {
    key: "locked",
    className: "bg-warning/20 text-warning",
    label: () => m.decks_overview_own_locked(),
  },
  {
    key: "missing",
    className: "bg-muted text-muted-foreground",
    label: () => m.decks_overview_own_missing(),
  },
] as const;

export function LabeledOwnershipBand({
  quantity,
  band,
  className,
}: {
  quantity: number;
  band: OwnershipBandSegments;
  className?: string;
}) {
  return (
    <span
      title={ownershipBandTitle(quantity, band)}
      className={cn(
        "text-2xs flex h-4 w-full gap-px overflow-hidden rounded-sm leading-4 font-medium",
        className,
      )}
    >
      {LABELED_SEGMENTS.map(
        (segment) =>
          band[segment.key] > 0 && (
            <span
              key={segment.key}
              className={cn("min-w-0 truncate px-1 text-center", segment.className)}
              style={{ flexGrow: band[segment.key], flexBasis: 0 }}
            >
              {segment.label()}
            </span>
          ),
      )}
    </span>
  );
}
