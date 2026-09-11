import { enumLabel } from "@openrift/shared/enum-label";
import { formatDayTime } from "@openrift/shared/format-date";
import { marketplaceCarriesLanguage } from "@openrift/shared/types/pricing";
import { formatCents, formatPrintingLabel } from "@openrift/shared/utils";
import { AlertTriangleIcon, CheckIcon, WandSparklesIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pressable } from "@/components/ui/pressable";
import type { AdminCellSlotProps } from "@/features/admin/components/admin-table";
import { nameBeyondCardName } from "@/features/admin/lib/name-suffix";
import type {
  AssignableCard,
  UnifiedMappingPrinting,
} from "@/features/admin/lib/price-mappings-types";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { useAssignableCardSearch } from "@/features/cards/hooks/use-card-search";
import { useEnumOrders } from "@/hooks/use-enums";

import { PrintingLabel } from "./marketplace-printing-label";
import type { MarketplaceHandlers, MarketplaceTableRow } from "./marketplace-product-entries";
import {
  displayedProductLanguage,
  isStaleRecord,
  MARKETPLACE_CONFIGS,
} from "./marketplace-product-entries";
import { AssignToPrintingButton, RowActions } from "./marketplace-row-actions";
import { SuggestionChip } from "./marketplace-suggestion-chip";
import { ProductLink } from "./price-mappings-utils";
import type { ProductSuggestion } from "./suggest-mapping";

type CellProps = AdminCellSlotProps<MarketplaceTableRow>;

export type RowSuggestion = ProductSuggestion & { printing: UnifiedMappingPrinting };

export function ProductCell({ row, cardName }: CellProps & { cardName: string }) {
  if (!row || !row.showProduct) {
    return null;
  }
  const { marketplace, product, isAssigned } = row.entry;
  const beyondCardName = nameBeyondCardName(product.productName, cardName);

  return (
    <span className="flex items-center gap-1.5">
      {isAssigned ? (
        <CheckIcon className="text-success size-3.5 shrink-0" />
      ) : (
        <span aria-hidden className="inline-block size-3.5 shrink-0" />
      )}
      <ProductLink config={MARKETPLACE_CONFIGS[marketplace]} externalId={product.externalId}>
        #{product.externalId}
      </ProductLink>
      {beyondCardName !== "" && (
        <>
          <AlertTriangleIcon
            aria-label={`This product's name does not match ${cardName}`}
            className="text-warning size-3.5 shrink-0"
          />
          <span className="text-warning truncate" title={product.productName}>
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
  const { marketplace, product } = row.entry;
  const parts = [
    displayedProductLanguage(marketplace, product.language),
    enumLabel(labels.finishes, product.finish),
  ].filter((part) => part !== null && part !== "");

  return <span className="whitespace-nowrap">{parts.join(" · ")}</span>;
}

export function PriceCell({ row }: CellProps) {
  if (!row) {
    return null;
  }
  const { product } = row.entry;
  const priceCents = product.marketCents ?? product.lowCents;

  return (
    <span className="flex items-center justify-end gap-1 tabular-nums">
      {isStaleRecord(new Date(product.recordedAt)) && (
        <span title={`Last seen ${formatDayTime(product.recordedAt)}`}>
          <AlertTriangleIcon className="text-destructive size-3.5" />
        </span>
      )}
      <span>{priceCents && priceCents > 0 ? formatCents(priceCents, product.currency) : ""}</span>
    </span>
  );
}

export function AssignedPrintingsCell({
  row,
  handlers,
  suggestionsByKey,
  onOpenPrinting,
}: CellProps & {
  handlers: MarketplaceHandlers;
  suggestionsByKey: ReadonlyMap<string, RowSuggestion[]>;
  onOpenPrinting?: (printingId: string) => void;
}) {
  if (!row) {
    return null;
  }
  const { product, assignedPrintings, isAssigned } = row.entry;
  const highlightLanguage =
    displayedProductLanguage(row.entry.marketplace, product.language) ?? undefined;
  const suggestions = isAssigned ? [] : (suggestionsByKey.get(row.key) ?? []);

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
                className="hover:underline"
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
            <ChipRemoveButton
              aria-label={`Unassign ${formatPrintingLabel(printing.shortCode, printing.markerSlugs, printing.finish, printing.language, printing.size)}`}
              title="Unassign"
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
        <SuggestionChip
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
  printings,
  allCards,
}: CellProps & {
  handlers: MarketplaceHandlers;
  printings: UnifiedMappingPrinting[];
  allCards: AssignableCard[];
}) {
  const [reassigning, setReassigning] = useState(false);
  const [cardQuery, setCardQuery] = useState("");
  const cardResults = useAssignableCardSearch(allCards, cardQuery);

  if (!row) {
    return null;
  }
  const { marketplace, product, isAssigned, assignedPrintingIds, otherAssignedPrintingIds } =
    row.entry;
  // A marketplace that does not stock a language drops its printings from the
  // Assign dropdown, the same way the suggester drops them.
  const assignablePrintings = printings.filter((printing) =>
    marketplaceCarriesLanguage(marketplace, printing.language),
  );
  const canReassign = !isAssigned && !product.isOverride;

  return (
    <>
      <span className="flex items-center justify-end gap-1">
        <AssignToPrintingButton
          printings={assignablePrintings}
          product={product}
          assignedPrintingIds={assignedPrintingIds}
          otherAssignedPrintingIds={otherAssignedPrintingIds}
          highlightFinish={product.finish}
          highlightLanguage={displayedProductLanguage(marketplace, product.language) ?? undefined}
          highlightSpecialMarkers={product.groupKind === "special"}
          onAssignToPrinting={(externalId, printingId) =>
            handlers.onAssignToPrinting(externalId, product.finish, product.language, printingId)
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

      <Dialog
        open={reassigning}
        onOpenChange={(next) => {
          if (!next) {
            setReassigning(false);
            setCardQuery("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Move #{product.externalId} to another card</DialogTitle>
          </DialogHeader>
          <CardSearchDropdown
            results={cardResults}
            onSearch={setCardQuery}
            onSelect={(cardId) => {
              handlers.onAssignToCard(product.externalId, product.finish, product.language, cardId);
              setReassigning(false);
              setCardQuery("");
            }}
            disabled={handlers.isAssigning}
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- admin-only UI, autofocus is intentional
            autoFocus
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
