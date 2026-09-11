import { getRouteApi } from "@tanstack/react-router";

import { parseSortParam, stringifySort } from "@/features/admin/lib/admin-cards-search";
import type { ServerSort } from "@/features/admin/lib/admin-table-types";

const cardsRouteApi = getRouteApi("/_app/_authenticated/admin/cards");

/** The active sort lives in the URL, so `AdminTable` gets a controlled sort and
 *  the rows are sorted here. */
export function useCardsTableSort<T>(
  sortValues: Record<string, (row: T) => string | number>,
  fallbackKey: string,
) {
  const navigate = cardsRouteApi.useNavigate();
  const tableSort = cardsRouteApi.useSearch({ select: (s) => s.tableSort });
  // Without a fallback the list would keep the API's order, which puts every
  // draft after every live card.
  const active = parseSortParam(tableSort).at(0) ?? { id: fallbackKey, desc: false };

  const serverSort: ServerSort = {
    key: active.id,
    direction: active.desc ? "desc" : "asc",
    onChange: ({ key, direction }) => {
      const next = key === null ? [] : [{ id: key, desc: direction === "desc" }];
      void navigate({
        search: (prev) => ({ ...prev, tableSort: stringifySort(next) }),
        replace: true,
      });
    },
  };

  function sortRows(rows: T[]): T[] {
    const value = sortValues[active.id];
    if (value === undefined) {
      return rows;
    }
    const direction = active.desc ? -1 : 1;
    return rows.toSorted((a, b) => {
      const left = value(a);
      const right = value(b);
      if (typeof left === "string" && typeof right === "string") {
        return left.localeCompare(right) * direction;
      }
      return ((left as number) - (right as number)) * direction;
    });
  }

  return { serverSort, sortRows };
}
