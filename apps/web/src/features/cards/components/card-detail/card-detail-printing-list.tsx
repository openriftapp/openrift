import { legendDisplayName } from "@openrift/shared/card-name";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import { ChevronDownIcon, ListFilterIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { PrintingDesignRows } from "@/features/cards/components/printing-design-rows";
import { useCards } from "@/features/cards/hooks/use-cards";
import { usePrices } from "@/features/cards/hooks/use-prices";
import { withCatalogPrintings } from "@/features/cards/lib/lightbox-printings";
import {
  groupPrintingDesigns,
  sortByLanguagePreference,
} from "@/features/cards/lib/printing-designs";
import { usePrintingLightboxStore } from "@/features/cards/stores/printing-lightbox-store";
import { useOwnedCountsForPrintings } from "@/features/collections/hooks/use-owned-count";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { formatterForMarketplace, priceColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

import { OwnedCollectionsPopover } from "./owned-collections-popover";
import { PrintingsLightbox } from "./printings-lightbox";

export function CardDetailPrintingList({
  current,
  printings,
  onSelect,
  collectionId,
  showImages,
}: {
  current: Printing;
  printings: Printing[];
  onSelect: (printing: Printing) => void;
  showImages?: boolean;
  /** Scopes each row's owned count to one collection; the wider total still shows. */
  collectionId?: string;
}) {
  const languageOrder = useEffectiveLanguageOrder();
  const pickedSideKey = usePrintingLightboxStore((state) => state.pickedSideKey);
  const clearPicked = usePrintingLightboxStore((state) => state.clearPicked);
  const { printingsByCardId } = useCards();
  const [revealedCardId, setRevealedCardId] = useState<string>();
  const revealed = revealedCardId === current.cardId;
  const allPrintings = withCatalogPrintings(printings, printingsByCardId.get(current.cardId) ?? []);
  const hiddenCount = allPrintings.length - printings.length;
  const currentHidden = !printings.some((p) => sideKey(p) === sideKey(current));
  const listed = revealed || currentHidden ? allPrintings : printings;
  const { designs } = groupPrintingDesigns(sortByLanguagePreference(listed, languageOrder));
  // One query for the whole list: a popover per row would each subscribe to
  // the entire copies collection.
  const { data: owned } = useOwnedCountsForPrintings(
    listed.map((p) => p.printingId),
    true,
    collectionId,
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <SectionHeading as="h3">{m.card_detail_printings_title()}</SectionHeading>
        <PrintingsLightbox
          printing={current}
          printings={allPrintings}
          showImages={showImages}
          onSelect={onSelect}
        />
      </div>
      <PrintingDesignRows
        designs={designs}
        selectedSideKey={sideKey(current)}
        highlightSideKey={pickedSideKey}
        onHighlightEnd={clearPicked}
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
      {hiddenCount > 0 && !currentHidden && (
        <Button
          variant="dashed"
          className="w-full justify-between px-3"
          aria-expanded={revealed}
          onClick={() => setRevealedCardId(revealed ? undefined : current.cardId)}
        >
          <ListFilterIcon />
          <span className="flex-1 text-left">
            {revealed
              ? m.card_detail_printings_hide_hidden()
              : m.card_detail_printings_show_hidden({ count: hiddenCount })}
          </span>
          <ChevronDownIcon className={cn("transition-transform", revealed && "rotate-180")} />
        </Button>
      )}
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
