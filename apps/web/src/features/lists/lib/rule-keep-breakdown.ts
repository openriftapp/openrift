import type { OwnedCopyRow, TradeCopySplit } from "@openrift/shared/list-rule-eval";
import type { Printing } from "@openrift/shared/types/catalog";

export interface BreakdownRow {
  printingId: string;
  pinned: boolean;
  count: number;
}

export interface RuleKeepBreakdown {
  kept: BreakdownRow[];
  onList: BreakdownRow[];
  outside: BreakdownRow[];
}

function rowsFor(copies: OwnedCopyRow[], pinned: ReadonlySet<string>): BreakdownRow[] {
  const rows = new Map<string, BreakdownRow>();
  for (const copy of copies) {
    const isPinned = pinned.has(copy.copyId);
    const key = `${copy.printingId}:${isPinned}`;
    const row = rows.get(key) ?? { printingId: copy.printingId, pinned: isPinned, count: 0 };
    row.count++;
    rows.set(key, row);
  }
  return [...rows.values()];
}

/** A double-sided copy keeps the rows and printings of both sides; either side can match a rule. */
export function cardEvalScope(
  cardId: string,
  catalog: readonly Printing[],
  ownedCopies: readonly OwnedCopyRow[],
): { catalog: Printing[]; ownedCopies: OwnedCopyRow[] } {
  const copyIds = new Set(
    ownedCopies.filter((copy) => copy.cardId === cardId).map((copy) => copy.copyId),
  );
  const rows = ownedCopies.filter((copy) => copyIds.has(copy.copyId));
  const printingIds = new Set(rows.map((copy) => copy.printingId));
  return {
    catalog: catalog.filter((printing) => printingIds.has(printing.printingId)),
    ownedCopies: rows,
  };
}

export function ruleKeepBreakdown(
  cardId: string,
  ownedCopies: readonly OwnedCopyRow[],
  split: TradeCopySplit,
  onListIds: ReadonlySet<string>,
  pinned: ReadonlySet<string>,
): RuleKeepBreakdown {
  const matchedIds = new Set([...split.kept, ...split.offered].map((copy) => copy.copyId));
  const cardCopies = [
    ...new Map(
      ownedCopies.filter((copy) => copy.cardId === cardId).map((copy) => [copy.copyId, copy]),
    ).values(),
  ];
  const onList = cardCopies.filter((copy) => onListIds.has(copy.copyId));
  const rest = cardCopies.filter((copy) => !onListIds.has(copy.copyId));
  return {
    kept: rowsFor(
      rest.filter((copy) => matchedIds.has(copy.copyId)),
      pinned,
    ),
    onList: rowsFor(onList, pinned),
    outside: rowsFor(
      rest.filter((copy) => !matchedIds.has(copy.copyId)),
      pinned,
    ),
  };
}
