import { formatPrintingLabel } from "@openrift/shared/printing-label";
import { Suspense, useState } from "react";

import { ComboboxPicker } from "@/components/combobox-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PrintingLabel } from "@/features/admin/components/marketplace-printing-label";
import { displayedProductLanguage } from "@/features/admin/lib/marketplace-product-entries";
import { ListingAnyPrintingCombobox } from "@/features/catalog-workspace/components/listing-any-printing-combobox";
import type { CardListingRow } from "@/features/catalog-workspace/lib/card-listing-rows";

export function listingHighlight(row: Pick<CardListingRow, "marketplace" | "product">): {
  finish: string;
  language: string | undefined;
  markers: boolean;
} {
  return {
    finish: row.product.finish,
    language: displayedProductLanguage(row.marketplace, row.product.language) ?? undefined,
    markers: row.product.groupKind === "special",
  };
}

export function ListingPrintingDialog({
  row,
  open,
  pending,
  onOpenChange,
  onPick,
}: {
  row: CardListingRow;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (printingId: string) => void;
}) {
  const [anyCard, setAnyCard] = useState(false);
  const pick = (printingId: string) => {
    setAnyCard(false);
    onPick(printingId);
  };
  const assignedIds = new Set(row.assignedPrintings.map((printing) => printing.printingId));
  const byId = new Map(row.assignablePrintings.map((printing) => [printing.printingId, printing]));
  const highlight = listingHighlight(row);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setAnyCard(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Map #{row.product.externalId} to a printing</DialogTitle>
        </DialogHeader>
        {anyCard ? (
          <Suspense fallback={<Skeleton className="h-9" />}>
            <ListingAnyPrintingCombobox
              language={highlight.language ?? null}
              disabled={pending}
              onPick={pick}
            />
          </Suspense>
        ) : row.assignablePrintings.length === 0 ? (
          <p className="text-muted-foreground">No printing of this card carries its language.</p>
        ) : (
          <ComboboxPicker
            trigger="input"
            inline
            aria-label="Printing"
            placeholder="Filter printings…"
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- admin-only dialog, the picker is its only control
            autoFocus
            disabled={pending}
            options={row.assignablePrintings.map((printing) => ({
              value: printing.printingId,
              label: formatPrintingLabel(
                printing.shortCode,
                printing.markerSlugs,
                printing.finish,
                printing.language,
                printing.size,
              ),
              disabled: assignedIds.has(printing.printingId),
            }))}
            renderOption={(option) => {
              const printing = byId.get(option.value);
              return printing ? (
                <span className="font-mono">
                  <PrintingLabel
                    printing={printing}
                    highlightFinish={highlight.finish}
                    highlightLanguage={highlight.language}
                    highlightMarkers={highlight.markers}
                  />
                </span>
              ) : (
                option.label
              );
            }}
            emptyText="No printing matches."
            value={null}
            onChange={(printingId) => {
              if (printingId !== null) {
                pick(printingId);
              }
            }}
          />
        )}
        <div>
          <Button variant="link-muted" size="xs" onClick={() => setAnyCard((value) => !value)}>
            {anyCard ? "Back to this card's printings" : "Search printings of all cards"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
