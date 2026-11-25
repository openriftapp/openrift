import { pluralize } from "@openrift/shared/strings";
import type {
  AdminMarketplaceName,
  AssignableCardResponse,
} from "@openrift/shared/types/api/admin";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { WandSparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { MarketplaceActionsCell } from "@/features/admin/components/marketplace-product-cells";
import type { MarketplaceHandlers } from "@/features/admin/lib/marketplace-product-entries";
import { SOURCE_CONFIGS } from "@/features/admin/lib/marketplace-sources";
import type { PrintingAssignment } from "@/features/admin/lib/printing-assignment";
import { ListingsTable } from "@/features/catalog-workspace/components/listings-table";
import type { CardListings } from "@/features/catalog-workspace/lib/card-listing-rows";

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
      variant={isWeak ? "outline-warning" : "outline"}
      size="xs"
      disabled={disabled}
      pending={disabled}
      onClick={() => onAccept(mappings)}
    >
      <WandSparklesIcon />
      Accept {mappings.length} {isWeak ? "weak " : ""}
      {pluralize(mappings.length, "suggestion")}
    </Button>
  );
}

export function MarketplaceProductsTable({
  listings,
  cardName,
  allCards,
  handlers,
  onOpenPrinting,
}: {
  listings: CardListings;
  cardName: string;
  allCards: AssignableCardResponse[];
  handlers: Record<AdminMarketplaceName, MarketplaceHandlers>;
  onOpenPrinting?: (printingId: string) => void;
}) {
  if (ALL_MARKETPLACES.every((marketplace) => listings.rows[marketplace].length === 0)) {
    return (
      <p className="text-muted-foreground text-sm">No marketplace products linked to this card.</p>
    );
  }

  return (
    <div className="space-y-6">
      {ALL_MARKETPLACES.map((marketplace) => {
        const rows = listings.rows[marketplace];
        if (rows.length === 0) {
          return null;
        }
        const marketplaceHandlers = handlers[marketplace];
        const acceptMappings = (mappings: PrintingAssignment[]) =>
          marketplaceHandlers.onBatchAssignToPrintings(mappings);
        return (
          <section key={marketplace} className="space-y-2">
            <ListingsTable
              rows={rows}
              cardName={cardName}
              handlers={marketplaceHandlers}
              minWidth="min-w-[60rem]"
              onOpenPrinting={onOpenPrinting}
              toolbar={
                <div className="flex w-full items-center gap-2">
                  <SectionHeading as="h3" size="sm">
                    {SOURCE_CONFIGS[marketplace].displayName}
                  </SectionHeading>
                  <div className="ml-auto flex items-center gap-2">
                    <AcceptSuggestionsButton
                      mappings={listings.strong[marketplace]}
                      disabled={marketplaceHandlers.isAssigningToPrinting}
                      onAccept={acceptMappings}
                    />
                    {listings.strongCount === 0 && (
                      <AcceptSuggestionsButton
                        mappings={listings.weak[marketplace]}
                        isWeak
                        disabled={marketplaceHandlers.isAssigningToPrinting}
                        onAccept={acceptMappings}
                      />
                    )}
                  </div>
                </div>
              }
              actions={
                <MarketplaceActionsCell handlers={marketplaceHandlers} allCards={allCards} />
              }
            />
          </section>
        );
      })}
    </div>
  );
}
