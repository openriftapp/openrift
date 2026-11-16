import type { CatalogPrintingResponse } from "@openrift/shared/types/api/catalog";

import { Heading } from "@/components/heading";
import { PullCard } from "@/features/pack-opener/components/pull-card";
import { compareRarityDesc, packRarityKey } from "@/features/pack-opener/lib/pack-pull-labels";
import type { PackResult } from "@/features/pack-opener/lib/pack-types";
import { m } from "@/paraglide/messages.js";

interface PackBulkGridProps {
  packs: PackResult[];
  imagesByPrintingId: Map<string, CatalogPrintingResponse["images"]>;
  shimmer?: boolean;
}

export function PackHeading({ index, count }: { index: number; count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Heading level={3}>{m.packs_pack_number({ number: index })}</Heading>
      <span className="text-muted-foreground text-xs">{m.packs_card_count({ count })}</span>
    </div>
  );
}

export function PackBulkGrid({ packs, imagesByPrintingId, shimmer }: PackBulkGridProps) {
  return (
    <div className="space-y-6">
      {packs.map((pack, packIndex) => {
        const sorted = pack.pulls.toSorted((a, b) =>
          compareRarityDesc(packRarityKey(a), packRarityKey(b)),
        );
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
