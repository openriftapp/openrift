import { formatDayTime } from "@openrift/shared/format-date";
import type {
  AssignableCardResponse,
  UnifiedMappingPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { formatCents } from "@openrift/shared/utils";
import { AlertTriangleIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { useAssignableCardSearch } from "@/features/cards/hooks/use-card-search";
import { MarketplaceLinkCell } from "@/features/catalog-admin/components/marketplace-link-cell";
import { MarketplaceRowActions } from "@/features/catalog-admin/components/marketplace-row-actions";
import type { MarketplaceActions } from "@/features/catalog-admin/hooks/use-marketplace-actions";
import type { MarketplaceVariantRow } from "@/features/catalog-admin/lib/marketplace-product-groups";

function variantLabel(variant: MarketplaceVariantRow): string {
  return [variant.displayLanguage, variant.finish].filter((part) => part !== null).join(" · ");
}

export function MarketplaceVariantRowCells({
  variant,
  assignable,
  allCards,
  actions,
  rowSpanCell,
  columnCount,
}: {
  variant: MarketplaceVariantRow;
  assignable: readonly UnifiedMappingPrintingResponse[];
  allCards: readonly AssignableCardResponse[];
  actions: MarketplaceActions;
  rowSpanCell?: ReactNode;
  columnCount: number;
}) {
  const [reassigning, setReassigning] = useState(false);
  const [cardQuery, setCardQuery] = useState("");
  const cardResults = useAssignableCardSearch([...allCards], cardQuery);

  const assignTo = (printingId: string) => {
    actions.assign([
      {
        marketplace: variant.marketplace,
        externalId: variant.externalId,
        finish: variant.finish,
        language: variant.language,
        printingId,
      },
    ]);
  };

  return (
    <>
      <TableRow>
        {rowSpanCell}
        <TableCell className="whitespace-nowrap">{variantLabel(variant)}</TableCell>
        <TableCell className="text-right tabular-nums">
          <span className="flex items-center justify-end gap-1.5">
            {variant.isStale && (
              <span title={`Last seen ${formatDayTime(variant.recordedAt)}`}>
                <Badge variant="warning">
                  <AlertTriangleIcon />
                  stale
                </Badge>
              </span>
            )}
            <span>
              {variant.priceCents === null
                ? "—"
                : formatCents(variant.priceCents, variant.currency)}
            </span>
          </span>
        </TableCell>
        <TableCell>
          <MarketplaceLinkCell variant={variant} actions={actions} onAssign={assignTo} />
        </TableCell>
        <TableCell>
          <MarketplaceRowActions
            variant={variant}
            assignable={assignable}
            actions={actions}
            onAssign={assignTo}
            onReassignToCard={() => setReassigning((open) => !open)}
            reassigning={reassigning}
          />
        </TableCell>
      </TableRow>
      {reassigning && (
        <TableRow>
          <TableCell colSpan={columnCount} className="bg-muted/30">
            <div className="max-w-md">
              <CardSearchDropdown
                results={cardResults}
                onSearch={setCardQuery}
                disabled={actions.isPending}
                onSelect={(cardId) => {
                  actions.assignToCard(
                    variant.marketplace,
                    variant.externalId,
                    variant.finish,
                    variant.language,
                    cardId,
                  );
                  setReassigning(false);
                  setCardQuery("");
                }}
              />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
