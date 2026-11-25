import { enumLabel } from "@openrift/shared/enum-label";
import { formatDayTime } from "@openrift/shared/format-date";
import { formatPrintingLabel } from "@openrift/shared/printing-label";
import type { AssignableCardResponse } from "@openrift/shared/types/api/admin";
import { AlertTriangleIcon, CheckIcon, WandSparklesIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { Pressable } from "@/components/ui/pressable";
import { textLinkVariants } from "@/components/ui/text-link";
import type { AdminCellSlotProps } from "@/features/admin/components/admin-table";
import type { MarketplaceHandlers } from "@/features/admin/lib/marketplace-product-entries";
import { displayedProductLanguage } from "@/features/admin/lib/marketplace-product-entries";
import {
  isStaleRecord,
  listingPriceCents,
  SOURCE_CONFIGS,
} from "@/features/admin/lib/marketplace-sources";
import { nameBeyondCardName } from "@/features/admin/lib/name-suffix";
import { ReassignCardDialog } from "@/features/catalog-workspace/components/reassign-card-dialog";
import type { CardListingRow } from "@/features/catalog-workspace/lib/card-listing-rows";
import { useEnumOrders } from "@/hooks/use-enums";
import { formatCentsInLocale } from "@/lib/format";

import { PrintingLabel } from "./marketplace-printing-label";
import { AssignToPrintingButton, RowActions } from "./marketplace-row-actions";
import { ProductSuggestionChip } from "./marketplace-suggestion-chip";
import { ProductLink } from "./price-mappings-utils";
import { usePrintingPairNames } from "./printing-pair-names";

type CellProps = AdminCellSlotProps<CardListingRow>;

export function ProductCell({ row, cardName }: CellProps & { cardName: string }) {
  if (!row || !row.showProduct) {
    return null;
  }
  const { marketplace, product, isAssigned } = row;
  const beyondCardName = nameBeyondCardName(product.productName, cardName);

  return (
    <span className="flex max-w-80 min-w-0 items-center gap-1.5">
      {isAssigned ? (
        <CheckIcon className="text-success size-3.5 shrink-0" />
      ) : (
        <span aria-hidden className="inline-block size-3.5 shrink-0" />
      )}
      <ProductLink config={SOURCE_CONFIGS[marketplace]} externalId={product.externalId}>
        #{product.externalId}
      </ProductLink>
      {beyondCardName !== "" && (
        <>
          <AlertTriangleIcon
            aria-label={`This product's name does not match ${cardName}`}
            className="text-warning size-3.5 shrink-0"
          />
          <span className="text-warning max-w-40 shrink-0 truncate" title={product.productName}>
            {beyondCardName}
          </span>
        </>
      )}
      {product.groupName !== null && (
        <span className="text-muted-foreground truncate text-sm" title={product.groupName}>
          {product.groupName}
        </span>
      )}
    </span>
  );
}

export function VariantCell({ row }: CellProps) {
  const { labels } = useEnumOrders();
  if (!row) {
    return null;
  }
  const { marketplace, product } = row;
  const parts = [
    displayedProductLanguage(marketplace, product.language),
    enumLabel(labels.finishes, product.finish),
  ].filter((part) => part !== null && part !== "");

  return <span className="whitespace-nowrap">{parts.join(" · ")}</span>;
}

export function ListingPrice({
  marketplace,
  product,
}: {
  marketplace: Parameters<typeof listingPriceCents>[0];
  product: Parameters<typeof listingPriceCents>[1] & {
    recordedAt: string;
    currency: Parameters<typeof formatCentsInLocale>[1];
  };
}) {
  const priceCents = listingPriceCents(marketplace, product);
  return (
    <span className="flex items-center justify-end gap-1 tabular-nums">
      {isStaleRecord(new Date(product.recordedAt)) && (
        <span title={`Last seen ${formatDayTime(product.recordedAt)} UTC`}>
          <AlertTriangleIcon className="text-destructive size-3.5" />
        </span>
      )}
      <span>{priceCents === null ? "" : formatCentsInLocale(priceCents, product.currency)}</span>
    </span>
  );
}

export function PriceCell({ row }: CellProps) {
  if (!row) {
    return null;
  }
  return <ListingPrice marketplace={row.marketplace} product={row.product} />;
}

export function AssignedPrintingsCell({
  row,
  handlers,
  onOpenPrinting,
}: CellProps & {
  handlers: MarketplaceHandlers;
  onOpenPrinting?: (printingId: string) => void;
}) {
  const pairNames = usePrintingPairNames();
  if (!row) {
    return null;
  }
  const { product, assignedPrintings, isAssigned } = row;
  const highlightLanguage =
    displayedProductLanguage(row.marketplace, product.language) ?? undefined;
  const suggestions = isAssigned ? [] : row.suggestions;

  if (assignedPrintings.length > 0) {
    return (
      <span className="flex flex-wrap gap-1">
        {assignedPrintings.map((printing) => (
          <Badge key={printing.printingId} variant="outline" className="gap-1 pr-1">
            {onOpenPrinting === undefined ? (
              <PrintingLabel
                printing={printing}
                highlightFinish={product.finish}
                highlightLanguage={highlightLanguage}
                highlightMarkers={
                  product.groupKind === "special" && printing.markerSlugs.length > 0
                }
              />
            ) : (
              <Pressable
                title="Show this printing on the page"
                className={textLinkVariants({ variant: "inherit" })}
                onClick={() => onOpenPrinting(printing.printingId)}
              >
                <PrintingLabel
                  printing={printing}
                  highlightFinish={product.finish}
                  highlightLanguage={highlightLanguage}
                  highlightMarkers={
                    product.groupKind === "special" && printing.markerSlugs.length > 0
                  }
                />
              </Pressable>
            )}
            {!pairNames.has(printing.printingId) && (
              <ChipRemoveButton
                aria-label={`Unmap ${formatPrintingLabel(printing.shortCode, printing.markerSlugs, printing.finish, printing.language, printing.size)}`}
                title="Unmap"
                disabled={handlers.isUnmappingPrinting}
                onClick={() =>
                  handlers.onUnmapPrinting(
                    printing.printingId,
                    product.externalId,
                    product.finish,
                    product.language,
                  )
                }
                className="text-muted-foreground hover:text-destructive -mr-0.5 disabled:opacity-50"
              />
            )}
          </Badge>
        ))}
      </span>
    );
  }

  if (suggestions.length === 0) {
    return <span className="text-muted-foreground/50">—</span>;
  }

  return (
    <span className="flex flex-wrap items-center gap-1">
      {suggestions.map((suggestion) => (
        <ProductSuggestionChip
          key={suggestion.printingId}
          suggestion={suggestion}
          productExternalId={product.externalId}
          highlightFinish={product.finish}
          highlightLanguage={highlightLanguage}
          highlightMarkers={
            product.groupKind === "special" && suggestion.printing.markerSlugs.length > 0
          }
          onAssign={(externalId, printingId) =>
            handlers.onAssignToPrinting(externalId, product.finish, product.language, printingId)
          }
          disabled={handlers.isAssigningToPrinting}
        />
      ))}
      {suggestions.length >= 2 && (
        <Button
          variant="outline"
          size="xs"
          disabled={handlers.isAssigningToPrinting}
          onClick={() =>
            handlers.onBatchAssignToPrintings(
              suggestions.map((suggestion) => ({
                externalId: product.externalId,
                finish: product.finish,
                language: product.language,
                printingId: suggestion.printingId,
              })),
            )
          }
        >
          <WandSparklesIcon />
          Accept all
        </Button>
      )}
    </span>
  );
}

export function MarketplaceActionsCell({
  row,
  handlers,
  allCards,
}: CellProps & {
  handlers: MarketplaceHandlers;
  allCards: AssignableCardResponse[];
}) {
  const [reassigning, setReassigning] = useState(false);

  if (!row) {
    return null;
  }
  const { marketplace, product, isAssigned, assignedPrintingIds, otherAssignedPrintingIds } = row;
  const canReassign = !isAssigned && !product.isOverride;

  return (
    <>
      <span className="flex items-center justify-end gap-1">
        <AssignToPrintingButton
          printings={row.assignablePrintings}
          product={product}
          assignedPrintingIds={assignedPrintingIds}
          otherAssignedPrintingIds={otherAssignedPrintingIds}
          highlightFinish={product.finish}
          highlightLanguage={displayedProductLanguage(marketplace, product.language) ?? undefined}
          highlightSpecialMarkers={product.groupKind === "special"}
          onAssignToPrinting={(externalId, printingId) =>
            void handlers.onAssignToPrinting(
              externalId,
              product.finish,
              product.language,
              printingId,
            )
          }
          isAssigning={handlers.isAssigningToPrinting}
        />
        <RowActions
          canIgnore={!isAssigned}
          canReassign={canReassign}
          canUnassign={Boolean(product.isOverride)}
          handlers={handlers}
          product={product}
          onToggleReassign={() => setReassigning(true)}
          showAssign={reassigning}
        />
      </span>

      <ReassignCardDialog
        externalId={product.externalId}
        open={reassigning}
        allCards={allCards}
        pending={handlers.isAssigning}
        onOpenChange={setReassigning}
        onPick={(cardId) => {
          handlers.onAssignToCard(product.externalId, product.finish, product.language, cardId);
          setReassigning(false);
        }}
      />
    </>
  );
}
