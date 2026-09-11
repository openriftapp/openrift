import type { AdminMarketplaceName } from "@openrift/shared/types/api/admin";
import { WandSparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AdminTable } from "@/features/admin/components/admin-table";
import type {
  AssignableCard,
  UnifiedMappingGroup,
  UnifiedMappingPrinting,
} from "@/features/admin/lib/price-mappings-types";

import type { RowSuggestion } from "./marketplace-product-cells";
import {
  AssignedPrintingsCell,
  MarketplaceActionsCell,
  PriceCell,
  ProductCell,
  VariantCell,
} from "./marketplace-product-cells";
import type {
  MarketplaceHandlers,
  MarketplaceTableRow,
  PrintingAssignment,
} from "./marketplace-product-entries";
import {
  buildMarketplaceRows,
  collectEntries,
  collectStrongMappings,
  collectWeakMappings,
  MARKETPLACE_CONFIGS,
} from "./marketplace-product-entries";
import type { ProductSuggestion } from "./suggest-mapping";
import { productSuggestionKey } from "./suggest-mapping";

const MARKETPLACES = ["tcgplayer", "cardmarket", "cardtrader"] as const;

function AcceptSuggestionsButton({
  mappings,
  isWeak,
  disabled,
  onAccept,
}: {
  mappings: PrintingAssignment[];
  isWeak?: boolean;
  disabled: boolean;
  onAccept: (mappings: PrintingAssignment[]) => void;
}) {
  if (mappings.length === 0) {
    return null;
  }
  return (
    <Button
      variant="outline"
      size="xs"
      disabled={disabled}
      onClick={() => onAccept(mappings)}
      className={isWeak ? "border-warning/40 text-warning hover:bg-warning-soft" : undefined}
    >
      <WandSparklesIcon />
      Accept {mappings.length} {isWeak ? "weak " : ""}suggestion
      {mappings.length === 1 ? "" : "s"}
    </Button>
  );
}

function MarketplaceTable({
  marketplace,
  rows,
  suggestionsByKey,
  printings,
  allCards,
  cardName,
  handlers,
  strong,
  weak,
  hasStrongElsewhere,
  onOpenPrinting,
}: {
  marketplace: AdminMarketplaceName;
  rows: MarketplaceTableRow[];
  suggestionsByKey: ReadonlyMap<string, RowSuggestion[]>;
  printings: UnifiedMappingPrinting[];
  allCards: AssignableCard[];
  cardName: string;
  handlers: MarketplaceHandlers;
  strong: PrintingAssignment[];
  weak: PrintingAssignment[];
  hasStrongElsewhere: boolean;
  onOpenPrinting?: (printingId: string) => void;
}) {
  return (
    <section className="space-y-2">
      <AdminTable<MarketplaceTableRow>
        columns={[
          {
            header: "Product",
            width: "w-72",
            wrap: true,
            cell: <ProductCell cardName={cardName} />,
          },
          { header: "Variant", width: "w-32", cell: <VariantCell /> },
          { header: "Price", width: "w-24", align: "right", cell: <PriceCell /> },
          {
            header: "Assigned printings",
            wrap: true,
            cell: (
              <AssignedPrintingsCell
                handlers={handlers}
                suggestionsByKey={suggestionsByKey}
                onOpenPrinting={onOpenPrinting}
              />
            ),
          },
        ]}
        data={rows}
        getRowKey={(row) => row.key}
        minWidth="min-w-[60rem]"
        toolbar={
          <div className="flex w-full items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {MARKETPLACE_CONFIGS[marketplace].displayName}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <AcceptSuggestionsButton
                mappings={strong}
                disabled={handlers.isAssigningToPrinting}
                onAccept={(mappings) => handlers.onBatchAssignToPrintings(mappings)}
              />
              {!hasStrongElsewhere && (
                <AcceptSuggestionsButton
                  mappings={weak}
                  isWeak
                  disabled={handlers.isAssigningToPrinting}
                  onAccept={(mappings) => handlers.onBatchAssignToPrintings(mappings)}
                />
              )}
            </div>
          </div>
        }
        actions={
          <MarketplaceActionsCell handlers={handlers} printings={printings} allCards={allCards} />
        }
      />
    </section>
  );
}

export function MarketplaceProductsTable({
  group,
  allCards,
  handlers,
  suggestions,
  onOpenPrinting,
}: {
  group: UnifiedMappingGroup;
  allCards: AssignableCard[];
  handlers: Record<AdminMarketplaceName, MarketplaceHandlers>;
  suggestions?: Map<string, ProductSuggestion[]>;
  onOpenPrinting?: (printingId: string) => void;
}) {
  const entries = collectEntries(group);

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No marketplace products linked to this card.</p>
    );
  }

  const printingById = new Map(group.printings.map((printing) => [printing.printingId, printing]));
  const strongByMarketplace = collectStrongMappings(group, suggestions);
  const weakByMarketplace = collectWeakMappings(group, suggestions);
  const totalStrong =
    strongByMarketplace.tcgplayer.length +
    strongByMarketplace.cardmarket.length +
    strongByMarketplace.cardtrader.length;

  return (
    <div className="space-y-6">
      {MARKETPLACES.map((marketplace) => {
        const rows = buildMarketplaceRows(entries, marketplace);
        if (rows.length === 0) {
          return null;
        }
        const suggestionsByKey = new Map<string, RowSuggestion[]>(
          rows.map((row) => [
            row.key,
            (
              suggestions?.get(
                productSuggestionKey(
                  marketplace,
                  row.entry.product.externalId,
                  row.entry.product.finish,
                  row.entry.product.language,
                ),
              ) ?? []
            ).flatMap((suggestion) => {
              const printing = printingById.get(suggestion.printingId);
              return printing ? [{ ...suggestion, printing }] : [];
            }),
          ]),
        );

        return (
          <MarketplaceTable
            key={marketplace}
            marketplace={marketplace}
            rows={rows}
            suggestionsByKey={suggestionsByKey}
            printings={group.printings}
            allCards={allCards}
            cardName={group.cardName}
            handlers={handlers[marketplace]}
            strong={strongByMarketplace[marketplace]}
            weak={weakByMarketplace[marketplace]}
            hasStrongElsewhere={totalStrong > 0}
            onOpenPrinting={onOpenPrinting}
          />
        );
      })}
    </div>
  );
}
