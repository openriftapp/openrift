import type { PackResult } from "@openrift/shared/pack-opener/types";
import type { CatalogPrintingResponse } from "@openrift/shared/types/api/catalog";
import { WellKnown } from "@openrift/shared/well-known";

import { Heading } from "@/components/heading";
import { PullCard } from "@/features/decks/components/pull-card";
import { m } from "@/paraglide/messages.js";

interface PackBulkGridProps {
  packs: PackResult[];
  imagesByPrintingId: Map<string, CatalogPrintingResponse["images"]>;
  shimmer?: boolean;
}

const RARITY_RANK: Record<string, number> = {
  Ultimate: 0,
  Showcase: 1,
  Epic: 2,
  Rare: 3,
  Uncommon: 4,
  Common: 5,
};

export function PackHeading({ index, count }: { index: number; count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Heading level={3}>{m.packs_pack_number({ number: index })}</Heading>
      <span className="text-muted-foreground text-xs">
        {count === 1 ? m.packs_card_count_one({ count }) : m.packs_card_count_other({ count })}
      </span>
    </div>
  );
}

export function PackBulkGrid({ packs, imagesByPrintingId, shimmer }: PackBulkGridProps) {
  return (
    <div className="space-y-6">
      {packs.map((pack, packIndex) => {
        const sorted = pack.pulls.toSorted((a, b) => {
          const keyA = a.slot === WellKnown.packSlot.ULTIMATE ? "Ultimate" : a.printing.rarity;
          const keyB = b.slot === WellKnown.packSlot.ULTIMATE ? "Ultimate" : b.printing.rarity;
          return (RARITY_RANK[keyA] ?? 99) - (RARITY_RANK[keyB] ?? 99);
        });
        return (
          <div key={packIndex} className="flex flex-col gap-2">
            <PackHeading index={packIndex + 1} count={pack.pulls.length} />
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7">
              {sorted.map((pull, i) => (
                <PullCard
                  key={`${pull.printing.id}-${i}`}
                  pull={pull}
                  image={imagesByPrintingId.get(pull.printing.id)?.[0]}
                  shimmer={shimmer}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
