import type { ListEntryDetailResponse, ListKind } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";

import {
  entrySelectionId,
  isRuleSelectionId,
  ruleSelectionItemId,
} from "@/features/lists/lib/list-entries";
import type { AddEntryToCollectionSubject, RuleEntryRef } from "@/features/lists/lib/list-move";
import { ruleEntryRef } from "@/features/lists/lib/list-move";

const PREVIEW_FAN = 3;

type EntryMap = ReadonlyMap<string, ListEntryDetailResponse>;
type PrintingMap = ReadonlyMap<string, Printing>;

/** A rule-derived entry copies as a fresh entry built from its card or printing. */
export interface RuleCopySubject {
  ruleEntry: RuleEntryRef;
  printing: Printing;
  totalQuantity: number;
  cardName: string;
}

/** A selection splits into rows the API can move and rule entries it can only re-add. */
export interface SelectionParts {
  entryIds: string[];
  ruleSubjects: RuleCopySubject[];
}

export function hasRuleSelection(ids: Iterable<string>): boolean {
  for (const id of ids) {
    if (isRuleSelectionId(id)) {
      return true;
    }
  }
  return false;
}

/** Selected ids in grid order; one card can span several tiles. */
export function orderedSelectedEntryIds(
  selected: ReadonlySet<string>,
  entryByItemId: EntryMap,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const [itemId, entry] of entryByItemId) {
    const id = entrySelectionId(itemId, entry);
    if (seen.has(id) || !selected.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function entrySelectionEntry(
  id: string,
  entryByItemId: EntryMap,
): ListEntryDetailResponse | undefined {
  if (isRuleSelectionId(id)) {
    return entryByItemId.get(ruleSelectionItemId(id));
  }
  for (const entry of entryByItemId.values()) {
    if (entry.id === id) {
      return entry;
    }
  }
  return undefined;
}

function entriesForSelection(
  ids: readonly string[],
  entryByItemId: EntryMap,
): Map<string, ListEntryDetailResponse> {
  const wanted = new Set(ids);
  const byId = new Map<string, ListEntryDetailResponse>();
  for (const [itemId, entry] of entryByItemId) {
    const id = entrySelectionId(itemId, entry);
    if (wanted.has(id) && !byId.has(id)) {
      byId.set(id, entry);
    }
  }
  return byId;
}

export function splitSelectionParts(
  ids: readonly string[],
  entryByItemId: EntryMap,
  printingByEntryId: PrintingMap,
): SelectionParts {
  const byId = entriesForSelection(ids, entryByItemId);
  const entryIds: string[] = [];
  const ruleSubjects: RuleCopySubject[] = [];
  for (const id of ids) {
    const entry = byId.get(id);
    if (!entry) {
      continue;
    }
    if (!isRuleSelectionId(id)) {
      entryIds.push(id);
      continue;
    }
    const printing = printingByEntryId.get(id);
    if (printing) {
      ruleSubjects.push({
        ruleEntry: ruleEntryRef(entry),
        printing,
        totalQuantity: entry.quantity,
        cardName: entry.cardName,
      });
    }
  }
  return { entryIds, ruleSubjects };
}

/** The drag fields a widened selection carries: movable rows, copies, total and fan. */
export function selectionDragFields(
  selectionIds: readonly string[],
  entryByItemId: EntryMap,
  printingByEntryId: PrintingMap,
): { entryIds: string[]; copyIds: string[]; totalQuantity: number; previewPrintings: Printing[] } {
  const byId = entriesForSelection(selectionIds, entryByItemId);
  const entries = selectionIds.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
  const previewPrintings: Printing[] = [];
  const seen = new Set<string>();
  for (const id of selectionIds) {
    const printing = printingByEntryId.get(id);
    if (printing && !seen.has(printing.id) && previewPrintings.length < PREVIEW_FAN) {
      seen.add(printing.id);
      previewPrintings.push(printing);
    }
  }
  return {
    entryIds: selectionIds.filter((id) => !isRuleSelectionId(id)),
    copyIds: entries.flatMap((entry) => (entry.kind === "copy" ? [entry.copyId] : [])),
    totalQuantity: entries.reduce((sum, entry) => sum + entry.quantity, 0),
    previewPrintings,
  };
}

/** The entries a collection add creates copies from, in grid order. */
export function listSelectionSubjects(
  ids: readonly string[],
  sourceKind: ListKind,
  entryByItemId: EntryMap,
  printingByEntryId: PrintingMap,
): AddEntryToCollectionSubject[] {
  const byId = entriesForSelection(ids, entryByItemId);
  return ids.flatMap((id) => {
    const entry = byId.get(id);
    const printing = printingByEntryId.get(id);
    if (!entry || !printing) {
      return [];
    }
    return [{ sourceKind, totalQuantity: entry.quantity, printing, cardName: entry.cardName }];
  });
}
