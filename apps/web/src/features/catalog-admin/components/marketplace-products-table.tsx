import { marketplaceLabel } from "@openrift/shared/marketplace";
import type {
  AdminMarketplaceName,
  AssignableCardResponse,
  UnifiedMappingPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { Fragment } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MARKETPLACE_TABLE_COLUMNS,
  MarketplaceProductGroupRows,
} from "@/features/catalog-admin/components/marketplace-product-group";
import type { MarketplaceActions } from "@/features/catalog-admin/hooks/use-marketplace-actions";
import type { MarketplaceProductGroup } from "@/features/catalog-admin/lib/marketplace-product-groups";

export function MarketplaceProductsTable({
  groups,
  assignable,
  allCards,
  actions,
}: {
  groups: readonly MarketplaceProductGroup[];
  assignable: Record<AdminMarketplaceName, UnifiedMappingPrintingResponse[]>;
  allCards: readonly AssignableCardResponse[];
  actions: MarketplaceActions;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-72">Product</TableHead>
            <TableHead className="w-32">Variant</TableHead>
            <TableHead className="w-24 text-right">Price</TableHead>
            <TableHead>Linked printing</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group, index) => (
            <Fragment key={group.key}>
              {groups[index - 1]?.marketplace !== group.marketplace && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={MARKETPLACE_TABLE_COLUMNS} className="bg-muted/30 py-1">
                    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {marketplaceLabel(group.marketplace)}
                    </span>
                  </TableCell>
                </TableRow>
              )}
              <MarketplaceProductGroupRows
                group={group}
                assignable={assignable[group.marketplace]}
                allCards={allCards}
                actions={actions}
              />
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
