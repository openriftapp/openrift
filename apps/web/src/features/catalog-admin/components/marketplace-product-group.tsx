import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import type {
  AssignableCardResponse,
  UnifiedMappingPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { TriangleAlertIcon } from "lucide-react";

import { TableCell } from "@/components/ui/table";
import { MarketplaceVariantRowCells } from "@/features/catalog-admin/components/marketplace-variant-row";
import type { MarketplaceActions } from "@/features/catalog-admin/hooks/use-marketplace-actions";
import type { MarketplaceProductGroup } from "@/features/catalog-admin/lib/marketplace-product-groups";
import { cn } from "@/lib/utils";

export const MARKETPLACE_TABLE_COLUMNS = 5;

export function MarketplaceProductGroupRows({
  group,
  assignable,
  allCards,
  actions,
}: {
  group: MarketplaceProductGroup;
  assignable: readonly UnifiedMappingPrintingResponse[];
  allCards: readonly AssignableCardResponse[];
  actions: MarketplaceActions;
}) {
  const productUrl = MARKETPLACE_LINKS[group.marketplace].productUrl(
    group.externalId,
    group.variants.at(0)?.displayLanguage,
  );

  return (
    <>
      {group.variants.map((variant, index) => (
        <MarketplaceVariantRowCells
          key={variant.key}
          variant={variant}
          assignable={assignable}
          allCards={allCards}
          actions={actions}
          columnCount={MARKETPLACE_TABLE_COLUMNS}
          rowSpanCell={
            index === 0 ? (
              <TableCell rowSpan={group.variants.length} className="align-top">
                <span className="flex max-w-64 items-center gap-1.5">
                  {group.nameMismatch && (
                    <TriangleAlertIcon
                      aria-label="This product name does not match the card name"
                      className="text-warning size-3.5 shrink-0"
                    />
                  )}
                  <span
                    className={cn("truncate font-medium", group.nameMismatch && "text-warning")}
                    title={group.productName}
                  >
                    {group.productName}
                  </span>
                </span>
                <a
                  href={productUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-2"
                >
                  #{group.externalId}
                </a>
                {group.groupName !== null && (
                  <span className="text-muted-foreground block max-w-64 truncate text-sm">
                    {group.groupName}
                  </span>
                )}
              </TableCell>
            ) : undefined
          }
        />
      ))}
    </>
  );
}
