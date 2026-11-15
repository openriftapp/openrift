import { SectionHeading } from "@/components/ui/section-heading";
import { OwnedVariantBreakdown } from "@/features/cards/components/owned-variant-breakdown";
import { useCards } from "@/features/cards/hooks/use-cards";
import type { VariantCollectionBreakdownEntry } from "@/features/collections/hooks/use-owned-count";
import { useOwnedCollectionsByVariants } from "@/features/collections/hooks/use-owned-count";
import { m } from "@/paraglide/messages.js";

function countCopies(variants: readonly VariantCollectionBreakdownEntry[]): number {
  let total = 0;
  for (const variant of variants) {
    for (const entry of variant.collections) {
      total += entry.count;
    }
  }
  return total;
}

/**
 * Popover body only: its live query reads the whole copies collection, so it
 * must mount when the popover opens, never once per row.
 */
export function OwnedCardBreakdown({ cardId }: { cardId: string }) {
  const { printingsByCardId } = useCards();
  const siblings = printingsByCardId.get(cardId) ?? [];
  const { data: breakdown } = useOwnedCollectionsByVariants(siblings, true);

  if (breakdown === undefined) {
    return (
      <p className="text-muted-foreground px-3 py-2.5 text-sm">{m.trades_counting_copies()}</p>
    );
  }

  return (
    <>
      <div className="flex items-baseline justify-between gap-2 px-3 pt-2.5 pb-1">
        <SectionHeading as="h3" size="sm">
          {m.trades_in_your_collections()}
        </SectionHeading>
        <span className="text-muted-foreground/70 text-2xs tabular-nums">
          {m.trades_total_count({ count: countCopies(breakdown) })}
        </span>
      </div>
      {breakdown.length === 0 ? (
        // Copies in a group collection belong to the group, never to the viewer.
        <p className="text-muted-foreground px-3 pt-1 pb-2.5 text-sm">
          {m.trades_none_in_your_collections()}
        </p>
      ) : (
        <OwnedVariantBreakdown variants={breakdown} />
      )}
    </>
  );
}
