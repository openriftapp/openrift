import type { CatalogCardRow } from "@openrift/shared/contracts/admin/catalog-review";
import { formatRelativeTime } from "@openrift/shared/format-date";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CardListRow } from "@/components/ui/card-list";
import type { CardsListSearch } from "@/features/catalog-admin/lib/catalog-card-list";
import { cardAttentionBadges } from "@/features/catalog-admin/lib/catalog-card-list";
import { cn } from "@/lib/utils";

export const CATALOG_ROW_HEIGHT = 44;

function RowBody({ row, unlinked }: { row: CatalogCardRow; unlinked: number }) {
  const badges = cardAttentionBadges(row, unlinked);
  const shortCode = row.shortCodes.at(0);

  return (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-medium">{row.name}</span>
        {row.cardSlug === null ? (
          <Badge variant="violet">Draft</Badge>
        ) : (
          shortCode && <span className="text-muted-foreground shrink-0 text-xs">{shortCode}</span>
        )}
      </span>
      <span className="text-muted-foreground hidden w-28 shrink-0 truncate text-sm sm:block">
        {row.firstSetName ?? "—"}
      </span>
      <span className="hidden w-36 shrink-0 truncate text-sm sm:block">
        {row.printingCount}
        {row.printingsWithoutImage > 0 && (
          <span className="text-muted-foreground"> · {row.printingsWithoutImage} no image</span>
        )}
      </span>
      <span className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-hidden md:flex">
        {badges.map((badge) => (
          <Badge key={badge.key} variant={badge.tone} className="shrink-0">
            {badge.label}
          </Badge>
        ))}
      </span>
      <span className="text-muted-foreground w-16 shrink-0 text-right text-xs">
        {formatRelativeTime(row.updatedAt)}
      </span>
      <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
    </>
  );
}

export function CatalogCardListRow({
  row,
  unlinked,
  listSearch,
}: {
  row: CatalogCardRow;
  unlinked: number;
  listSearch: CardsListSearch;
}) {
  const cardSlug = row.cardSlug;
  const className = cn("h-11", cardSlug === null && "bg-violet-soft");

  return (
    <li className="shrink-0">
      {cardSlug === null ? (
        <CardListRow
          className={className}
          render={
            <Link
              to="/admin/catalog/drafts/$name"
              params={{ name: row.normName }}
              search={listSearch}
            />
          }
        >
          <RowBody row={row} unlinked={unlinked} />
        </CardListRow>
      ) : (
        <CardListRow
          className={className}
          render={
            <Link to="/admin/catalog/cards/$cardSlug" params={{ cardSlug }} search={listSearch} />
          }
        >
          <RowBody row={row} unlinked={unlinked} />
        </CardListRow>
      )}
    </li>
  );
}
