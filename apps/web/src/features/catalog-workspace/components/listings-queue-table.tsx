import { countNoun, pluralize } from "@openrift/shared/strings";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { TextLink } from "@/components/ui/text-link";
import { InstantCell } from "@/features/admin/components/admin-crud-shared";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import { AssignSuggestedListingsButton } from "@/features/catalog-workspace/components/batch-dialogs";
import { ListState } from "@/features/catalog-workspace/components/list-state";
import { CardThumb } from "@/features/catalog-workspace/components/record/record-thumb";
import type { ListingCard } from "@/features/catalog-workspace/lib/listings";
import { listingCardSummary, selectListingCards } from "@/features/catalog-workspace/lib/listings";
import { listingsQueryOptions } from "@/features/catalog-workspace/lib/listings-queries";

function CardCell({ row }: AdminCellSlotProps<ListingCard>) {
  if (!row) {
    return null;
  }
  return (
    <span className="flex items-center gap-2">
      <CardThumb cardSlug={row.cardSlug} />
      <TextLink
        variant="inherit"
        className="font-medium after:absolute after:inset-0"
        render={
          <Link
            to="/admin/workspace/cards/$cardSlug"
            params={{ cardSlug: row.cardSlug }}
            search
            hash="listings"
          />
        }
      >
        {row.cardName}
      </TextLink>
    </span>
  );
}

function PendingCell({ row }: AdminCellSlotProps<ListingCard>) {
  return row ? <span className="text-muted-foreground">{listingCardSummary(row)}</span> : null;
}

const columns: AdminColumnDef<ListingCard>[] = [
  { header: "Card", width: "w-72", sortValue: (row) => row.cardName, cell: <CardCell /> },
  {
    header: "Pending",
    wrap: true,
    sortValue: (row) => row.suggestedPrintings + row.withoutPrinting,
    sortFirst: "desc",
    cell: <PendingCell />,
  },
  {
    header: "Waiting",
    width: "w-24",
    align: "right",
    sortValue: (row) => row.waitingSince,
    cell: <InstantCell<ListingCard> at={(row) => row.waitingSince} relative />,
  },
];

export function ListingsQueueTable({ query, controls }: { query: string; controls: ReactNode }) {
  const listingsQuery = useQuery(listingsQueryOptions());
  const { data } = listingsQuery;
  const all = data?.cards ?? [];
  const noCardCount = data?.noCardCount ?? 0;

  return (
    <ListState isPending={listingsQuery.isPending} error={listingsQuery.error} toolbar={controls}>
      <div className="space-y-3">
        <AdminTable
          columns={columns}
          data={selectListingCards(all, query)}
          getRowKey={(card) => card.cardSlug}
          stacked
          rowClassName={() => "relative"}
          emptyText={all.length === 0 ? "No listing is waiting." : "No card matches this search."}
          minWidth="min-w-[640px]"
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              {controls}
              <span className="text-muted-foreground text-sm">{countNoun(all.length, "card")}</span>
              <span className="flex-1" />
              <AssignSuggestedListingsButton />
            </div>
          }
        />
        {noCardCount > 0 && (
          <TextLink render={<Link to="/admin/unmatched" />}>
            {countNoun(noCardCount, "listing")} {pluralize(noCardCount, "matches", "match")} no card
          </TextLink>
        )}
      </div>
    </ListState>
  );
}
