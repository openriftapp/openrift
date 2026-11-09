import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import {
  printingCopiesInZone,
  printingRemoveTarget,
} from "@/features/decks/lib/deck-printing-counts";

type PlanEntry = Pick<DeckBuilderCard, "zone" | "preferredPrintingId" | "quantity">;

export function deckDetailControlsApply({
  workbench,
  isSingleCardZone,
  activeZone,
}: {
  workbench: boolean;
  isSingleCardZone: boolean;
  activeZone: DeckZone;
}): boolean {
  return (
    workbench &&
    !isSingleCardZone &&
    activeZone !== WellKnown.deckZone.LEGEND_OPTIONS &&
    activeZone !== WellKnown.deckZone.BATTLEFIELD
  );
}

export interface PrintingStock {
  available: Readonly<Record<string, number>>;
  excluded: Readonly<Record<string, number>>;
  lent: Readonly<Record<string, number>>;
}

export interface UncoveredCopies {
  excluded: number;
  lent: number;
  notOwned: number;
}

export interface DeckDetailRow {
  copies: number;
  uncovered: UncoveredCopies | undefined;
  isDefault: boolean;
  removeTarget: string | null | undefined;
  addPrintingId: string | null;
}

type Counts = Readonly<Record<string, number>>;

function addCounts(a: Counts, b: Counts): Record<string, number> {
  const sum: Record<string, number> = { ...a };
  for (const [key, count] of Object.entries(b)) {
    sum[key] = (sum[key] ?? 0) + count;
  }
  return sum;
}

export function deckPrintingStock(
  counts: {
    available: Counts;
    lockedExcluded: Counts;
    lockedLoaned: Counts;
    lockedReserved: Counts;
  },
  countExcluded: boolean,
): PrintingStock {
  return {
    available: countExcluded
      ? addCounts(counts.available, counts.lockedExcluded)
      : counts.available,
    excluded: countExcluded ? {} : counts.lockedExcluded,
    lent: addCounts(counts.lockedLoaned, counts.lockedReserved),
  };
}

function uncoveredCopies(
  copies: number,
  printingId: string,
  stock: PrintingStock,
): UncoveredCopies | undefined {
  let left = copies - (stock.available[printingId] ?? 0);
  if (left <= 0) {
    return undefined;
  }
  const excluded = Math.min(left, stock.excluded[printingId] ?? 0);
  left -= excluded;
  const lent = Math.min(left, stock.lent[printingId] ?? 0);
  return { excluded, lent, notOwned: left - lent };
}

export interface DeckDetailPlan<T extends PlanEntry> {
  zones: { zone: DeckZone; count: number }[] | undefined;
  looseEntries: T[];
  canAdd: boolean;
  row: (printingId: string) => DeckDetailRow;
}

export function planDeckCardDetail<T extends PlanEntry>({
  cardEntries,
  activeZone,
  detailZone,
  zoneSwitchable,
  defaultPrintingId,
  rowPrintingIds,
  activeZoneFull,
  copyLimitReached,
  isFreeform,
  stock,
}: {
  cardEntries: readonly T[];
  activeZone: DeckZone;
  detailZone: DeckZone;
  zoneSwitchable: boolean;
  defaultPrintingId: string | undefined;
  rowPrintingIds: ReadonlySet<string>;
  activeZoneFull: boolean;
  copyLimitReached: boolean;
  isFreeform: boolean;
  stock?: PrintingStock;
}): DeckDetailPlan<T> {
  const shownZones: DeckZone[] = zoneSwitchable
    ? [WellKnown.deckZone.MAIN, WellKnown.deckZone.SIDEBOARD]
    : [detailZone];
  const zoneEntries = cardEntries.filter((entry) => entry.zone === detailZone);
  const hasRow = (entry: T) => {
    const printingId = entry.preferredPrintingId ?? defaultPrintingId;
    return printingId !== undefined && rowPrintingIds.has(printingId);
  };

  return {
    zones: zoneSwitchable
      ? shownZones.map((zone) => ({
          zone,
          count: cardEntries
            .filter((entry) => entry.zone === zone)
            .reduce((sum, entry) => sum + entry.quantity, 0),
        }))
      : undefined,
    looseEntries: cardEntries.filter(
      (entry) => !shownZones.includes(entry.zone) || (entry.zone === detailZone && !hasRow(entry)),
    ),
    canAdd: detailZone === activeZone ? !activeZoneFull : isFreeform || !copyLimitReached,
    row: (printingId) => {
      const isDefault = printingId === defaultPrintingId;
      const copies = printingCopiesInZone(zoneEntries, printingId, defaultPrintingId);
      return {
        copies,
        uncovered: stock && uncoveredCopies(copies, printingId, stock),
        isDefault,
        removeTarget: printingRemoveTarget(zoneEntries, printingId, defaultPrintingId),
        addPrintingId: isDefault ? null : printingId,
      };
    },
  };
}
