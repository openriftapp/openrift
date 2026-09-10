import type { CatalogCardRow } from "@openrift/shared/contracts/admin/catalog-review";
import { useRef, useState } from "react";

import { CardList } from "@/components/ui/card-list";
import {
  CATALOG_ROW_HEIGHT,
  CatalogCardListRow,
} from "@/features/catalog-admin/components/catalog-card-list-row";
import type { CardsListSearch } from "@/features/catalog-admin/lib/catalog-card-list";
import { catalogCardKey } from "@/features/catalog-admin/lib/catalog-card-list";
import { useScopeLayoutEffect } from "@/hooks/use-scope-effect";
import { useWindowVirtualizerFresh } from "@/lib/virtualizer-fresh";

const OVERSCAN = 12;

export function CatalogCardsList({
  rows,
  unlinkedFor,
  listSearch,
}: {
  rows: readonly CatalogCardRow[];
  unlinkedFor: (row: CatalogCardRow) => number;
  listSearch: CardsListSearch;
}) {
  const anchorRef = useRef<HTMLLIElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  // A changed row count moves the anchor, so the margin is measured again.
  useScopeLayoutEffect(rows.length, () => {
    const el = anchorRef.current;
    if (el) {
      setScrollMargin(Math.round(el.getBoundingClientRect().top + globalThis.scrollY));
    }
  });

  const { virtualItems, totalSize } = useWindowVirtualizerFresh({
    count: rows.length,
    estimateSize: () => CATALOG_ROW_HEIGHT,
    overscan: OVERSCAN,
    scrollMargin,
  });

  const first = virtualItems.at(0);
  const last = virtualItems.at(-1);

  return (
    <CardList>
      <li ref={anchorRef} className="h-0 shrink-0" />
      {/* Spacer heights are list-relative; virtual items are reported in
          document space, so scrollMargin is subtracted here and added back below. */}
      {first && <li className="shrink-0" style={{ height: first.start - scrollMargin }} />}
      {virtualItems.map((item) => {
        const row = rows[item.index];
        if (!row) {
          return null;
        }
        return (
          <CatalogCardListRow
            key={catalogCardKey(row)}
            row={row}
            unlinked={unlinkedFor(row)}
            listSearch={listSearch}
          />
        );
      })}
      {last && <li className="shrink-0" style={{ height: totalSize - last.end + scrollMargin }} />}
    </CardList>
  );
}
