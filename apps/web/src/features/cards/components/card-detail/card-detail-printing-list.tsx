import { legendDisplayName } from "@openrift/shared/card-name";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import { ChevronDownIcon, ListFilterIcon } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

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
  rowEnd,
  rowNote,
  keepListed,
  hiddenAreOtherLanguages,
}: {
  current: Printing;
  printings: Printing[];
  onSelect: (printing: Printing) => void;
  showImages?: boolean;
  rowEnd?: (printing: Printing) => ReactNode;
  rowNote?: (printing: Printing) => ReactNode;
  keepListed?: (printing: Printing) => boolean;
  hiddenAreOtherLanguages?: boolean;
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
  const visible = keepListed
    ? allPrintings.filter(
        (p) => keepListed(p) || printings.some((shown) => sideKey(shown) === sideKey(p)),
      )
    : printings;
  const hiddenCount = allPrintings.length - visible.length;
  const currentHidden = !visible.some((p) => sideKey(p) === sideKey(current));
  const listed = revealed || currentHidden ? allPrintings : visible;
  const ordered = sortByLanguagePreference(listed, languageOrder);
  const designs = rowEnd
    ? ordered.map((p) => ({ key: sideKey(p), lead: p, byLanguage: new Map([[p.language, p]]) }))
    : groupPrintingDesigns(ordered).designs;
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
        details={rowNote && ((design) => rowNote(design.lead))}
        right={(p) => (
          <>
            <span className={cn(rowEnd && "hidden md:contents")}>
              <PrintingPrices printing={p} />
            </span>
            {rowEnd?.(p)}
          </>
        )}
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
            {hiddenAreOtherLanguages
              ? revealed
                ? m.card_detail_printings_hide_other_languages()
                : m.card_detail_printings_show_other_languages({ count: hiddenCount })
              : revealed
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
