import { legendDisplayName } from "@openrift/shared/card-name";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import { useState } from "react";

import { SectionHeading } from "@/components/ui/section-heading";
import { PrintingLanguageTabs } from "@/features/cards/components/printing-language-tabs";
import { PrintingRowContent } from "@/features/cards/components/printing-row";
import { usePrices } from "@/features/cards/hooks/use-prices";
import {
  isSelectedSide,
  oneEntryPerSelfPairedPrinting,
} from "@/features/cards/lib/printing-designs";
import { useOwnedCountsForPrintings } from "@/features/collections/hooks/use-owned-count";
import { useLanguageList } from "@/hooks/use-enums";
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
  const languageOrder = useLanguageList();

  // Keyed on printing id so switching printings resets the tab without an effect.
  const [picked, setPicked] = useState<{ language: string; forPrintingId: string } | null>(null);

  const pickedLanguage =
    picked?.forPrintingId === current.printingId ? picked.language : current.language;

  return (
    <div className="space-y-2">
      <PrintingLanguageTabs
        printings={oneEntryPerSelfPairedPrinting(printings)}
        languageOrder={languageOrder.map((entry) => entry.code)}
        activeLanguage={pickedLanguage}
        onLanguageChange={(next) =>
          setPicked({ language: next, forPrintingId: current.printingId })
        }
        header={<PickerHeading />}
      >
        {(shown) => (
          <PrintingList
            printings={shown}
            current={current}
            onSelect={onSelect}
            collectionId={collectionId}
          />
        )}
      </PrintingLanguageTabs>
    </div>
  );
}

function PickerHeading() {
  return (
    <SectionHeading as="h3" className="shrink-0">
      {m.card_detail_printings_title()}
    </SectionHeading>
  );
}

function PrintingList({
  printings,
  current,
  onSelect,
  collectionId,
}: {
  printings: Printing[];
  current: Printing;
  onSelect: (printing: Printing) => void;
  collectionId?: string;
}) {
  // One query for the whole list: a popover per row would each subscribe to
  // the entire copies collection.
  const { data: owned } = useOwnedCountsForPrintings(
    printings.map((p) => p.printingId),
    true,
    collectionId,
  );

  return (
    <div className="space-y-1">
      {printings.map((p) => {
        const isActive = isSelectedSide(p, sideKey(current));
        return (
          <div
            key={sideKey(p)}
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- can't use <button>; the row contains the OwnedCollectionsPopover trigger button, and nested buttons are invalid HTML
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            onClick={() => onSelect(p)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(p);
              }
            }}
            className={cn(
              "-mx-2.5 flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
              isActive ? "bg-muted ring-border ring-1" : "hover:bg-muted/50",
            )}
          >
            <PrintingRowContent
              printing={p}
              siblings={printings}
              right={
                <>
                  <OwnedCollectionsPopover
                    printingId={p.printingId}
                    cardName={legendDisplayName(p.card)}
                    shortCode={p.shortCode}
                    count={owned?.totals[p.printingId] ?? 0}
                    totalCount={owned?.allTotals[p.printingId] ?? 0}
                    otherSideName={p.otherSide?.cardName}
                  />
                  <PrintingPrices printing={p} />
                </>
              }
            />
          </div>
        );
      })}
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
