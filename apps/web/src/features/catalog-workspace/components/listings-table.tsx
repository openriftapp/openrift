import type { ReactElement, ReactNode } from "react";

import type { AdminCellSlotProps } from "@/features/admin/components/admin-table";
import { AdminTable } from "@/features/admin/components/admin-table";
import {
  AssignedPrintingsCell,
  PriceCell,
  ProductCell,
  VariantCell,
} from "@/features/admin/components/marketplace-product-cells";
import type { MarketplaceHandlers } from "@/features/admin/lib/marketplace-product-entries";
import type { CardListingRow } from "@/features/catalog-workspace/lib/card-listing-rows";

export function ListingsTable({
  rows,
  cardName,
  handlers,
  minWidth,
  toolbar,
  actions,
  onOpenPrinting,
}: {
  rows: CardListingRow[];
  cardName: string;
  handlers: MarketplaceHandlers;
  minWidth: string;
  toolbar: ReactNode;
  actions: ReactElement<AdminCellSlotProps<CardListingRow>>;
  onOpenPrinting?: (printingId: string) => void;
}) {
  return (
    <AdminTable<CardListingRow>
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
          cell: <AssignedPrintingsCell handlers={handlers} onOpenPrinting={onOpenPrinting} />,
        },
      ]}
      data={rows}
      getRowKey={(row) => row.key}
      minWidth={minWidth}
      toolbar={toolbar}
      actions={actions}
    />
  );
}
