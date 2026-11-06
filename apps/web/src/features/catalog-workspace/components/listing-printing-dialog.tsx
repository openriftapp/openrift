import { formatPrintingLabel } from "@openrift/shared/printing-label";

import { ComboboxPicker } from "@/components/combobox-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrintingLabel } from "@/features/admin/components/marketplace-printing-label";
import type { CardListingRow } from "@/features/catalog-workspace/lib/card-listing-rows";

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
  const assignedIds = new Set(row.assignedPrintings.map((printing) => printing.printingId));
  const byId = new Map(row.assignablePrintings.map((printing) => [printing.printingId, printing]));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign #{row.product.externalId} to a printing</DialogTitle>
        </DialogHeader>
        {row.assignablePrintings.length === 0 ? (
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
                    highlightFinish={row.product.finish}
                    highlightLanguage={row.product.language ?? undefined}
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
                onPick(printingId);
              }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
