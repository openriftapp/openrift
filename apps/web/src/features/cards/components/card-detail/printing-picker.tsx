import { legendDisplayName } from "@openrift/shared/card-name";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";

import { SectionHeading } from "@/components/ui/section-heading";
import { PrintingDesignRows } from "@/features/cards/components/printing-design-rows";
import { usePrices } from "@/features/cards/hooks/use-prices";
import {
  groupPrintingDesigns,
  sortByLanguagePreference,
} from "@/features/cards/lib/printing-designs";
import { useOwnedCountsForPrintings } from "@/features/collections/hooks/use-owned-count";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { formatterForMarketplace, priceColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

import { OwnedCollectionsPopover } from "./owned-collections-popover";

export function PrintingPicker({
  current,
  printings,
  onSelect,
  collectionId,
}: {
  current: Printing;
  printings: Printing[];
  onSelect: (printing: Printing) => void;
  /** Scopes each row's owned count to one collection; the wider total still shows. */
  collectionId?: string;
}) {
  const languageOrder = useEffectiveLanguageOrder();
  const { designs } = groupPrintingDesigns(sortByLanguagePreference(printings, languageOrder));
  // One query for the whole list: a popover per row would each subscribe to
  // the entire copies collection.
  const { data: owned } = useOwnedCountsForPrintings(
    printings.map((p) => p.printingId),
    true,
    collectionId,
  );

  return (
    <div className="space-y-2">
      <SectionHeading as="h3">{m.card_detail_printings_title()}</SectionHeading>
      <PrintingDesignRows
        designs={designs}
        selectedSideKey={sideKey(current)}
        onSelect={onSelect}
        badge={(p) => (
          <OwnedCollectionsPopover
            badge
            align="start"
            printingId={p.printingId}
            cardName={legendDisplayName(p.card)}
            printing={p}
            count={owned?.totals[p.printingId] ?? 0}
            totalCount={owned?.allTotals[p.printingId] ?? 0}
            otherSideName={p.otherSide?.cardName}
          />
        )}
        right={(p) => <PrintingPrices printing={p} />}
      />
    </div>
  );
}

function PrintingPrices({ printing }: { printing: Printing }) {
  const marketplaceOrder = useDisplayStore((s) => s.marketplaceOrder);
  const prices = usePrices();

  const marketplace = marketplaceOrder.find(
    (candidate) => prices.get(printing.printingId, candidate) !== undefined,
  );
  const value =
    marketplace === undefined ? undefined : prices.get(printing.printingId, marketplace);

  if (marketplace === undefined || value === undefined) {
    return null;
  }

  return (
    <span className="flex shrink-0 items-baseline gap-1">
      {marketplace === marketplaceOrder[0] ? null : (
        <span className="text-muted-foreground text-xs">{marketplaceLabel(marketplace)}</span>
      )}
      <span className={cn("text-xs font-semibold", priceColorClass(value))}>
        {formatterForMarketplace(marketplace)(value)}
      </span>
    </span>
  );
}
