import { sideKey } from "@openrift/shared/printing-side";
import type { ListEntryDetailResponse, ListKind } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";

import type { CardViewerItem } from "@/lib/card-viewer-types";
import { m } from "@/paraglide/messages.js";

export function emptyStateCopy(kind: ListKind): { title: string; description: string } {
  if (kind === "copy") {
    return {
      title: m.lists_entry_empty_copy_title(),
      description: m.lists_entry_empty_copy_description(),
    };
  }
  if (kind === "printing") {
    return {
      title: m.lists_entry_empty_printing_title(),
      description: m.lists_entry_empty_printing_description(),
    };
  }
  return {
    title: m.lists_entry_empty_card_title(),
    description: m.lists_entry_empty_card_description(),
  };
}

export function kindToView(kind: ListKind): "cards" | "printings" | "copies" {
  if (kind === "card") {
    return "cards";
  }
  if (kind === "printing") {
    return "printings";
  }
  return "copies";
}

export function collectListPrintings(
  entries: readonly ListEntryDetailResponse[],
  printingsById: Record<string, Printing>,
  printingsByCardId: ReadonlyMap<string, Printing[]>,
  sidesByPrinting: ReadonlyMap<string, readonly Printing[]> = new Map(),
): {
  listPrintings: Printing[];
  entriesBySideKey: Map<string, ListEntryDetailResponse[]>;
} {
  const listPrintings: Printing[] = [];
  const entriesBySideKey = new Map<string, ListEntryDetailResponse[]>();
  for (const entry of entries) {
    const printing = resolveEntryPrinting(entry, printingsById, printingsByCardId);
    if (!printing) {
      continue;
    }
    const sides = entry.kind === "card" ? undefined : sidesByPrinting.get(printing.printingId);
    for (const side of sides && sides.length > 1 ? sides : [printing]) {
      const existing = entriesBySideKey.get(sideKey(side));
      if (existing) {
        existing.push(entry);
      } else {
        listPrintings.push(side);
        entriesBySideKey.set(sideKey(side), [entry]);
      }
    }
  }
  return { listPrintings, entriesBySideKey };
}

export function resolveEntryPrinting(
  entry: ListEntryDetailResponse,
  printingsById: Record<string, Printing>,
  printingsByCardId: ReadonlyMap<string, Printing[]>,
): Printing | undefined {
  switch (entry.kind) {
    case "printing":
    case "copy": {
      return printingsById[entry.printingId];
    }
    case "card": {
      return printingsByCardId.get(entry.cardId)?.[0];
    }
  }
}

export function buildItems(
  view: "cards" | "printings" | "copies",
  sortedCards: Printing[],
  entriesBySideKey: Map<string, ListEntryDetailResponse[]>,
): {
  items: CardViewerItem[];
  entryByItemId: Map<string, ListEntryDetailResponse>;
} {
  const items: CardViewerItem[] = [];
  const entryByItemId = new Map<string, ListEntryDetailResponse>();
  if (view === "copies") {
    const seenPrintings = new Set<string>();
    for (const printing of sortedCards) {
      if (seenPrintings.has(printing.printingId)) {
        continue;
      }
      seenPrintings.add(printing.printingId);
      const entriesForPrinting = entriesBySideKey.get(sideKey(printing)) ?? [];
      for (const entry of entriesForPrinting) {
        // Rule-derived copy entries have no entry id, so fall back to the copyId.
        const itemId = entry.id ?? (entry.kind === "copy" ? entry.copyId : printing.printingId);
        items.push({ id: itemId, printing });
        entryByItemId.set(itemId, entry);
      }
    }
    return { items, entryByItemId };
  }
  for (const printing of sortedCards) {
    const first = entriesBySideKey.get(sideKey(printing))?.[0];
    items.push({ id: sideKey(printing), printing });
    if (first) {
      entryByItemId.set(sideKey(printing), first);
    }
  }
  return { items, entryByItemId };
}

export function buildItemsFromCatalog(sortedCards: Printing[]): {
  items: CardViewerItem[];
  entryByItemId: Map<string, ListEntryDetailResponse>;
} {
  const items: CardViewerItem[] = sortedCards.map((printing) => ({
    id: sideKey(printing),
    printing,
  }));
  // Empty on purpose: add mode reads quantities via the kind-keyed entryByKey map instead.
  return { items, entryByItemId: new Map() };
}

const RULE_SELECTION_PREFIX = "rule:";

/**
 * Rule-derived entries have no `list_entries` row, so the selection tracks
 * them by tile id instead; the row actions refuse a selection holding one.
 * Both side tiles of a printing entry share the side-1 tile's id.
 */
export function entrySelectionId(itemId: string, entry: ListEntryDetailResponse): string {
  if (entry.id !== null) {
    return entry.id;
  }
  const tileId = entry.kind === "printing" ? itemId.replace(/:2$/u, "") : itemId;
  return `${RULE_SELECTION_PREFIX}${tileId}`;
}

export function isRuleSelectionId(id: string): boolean {
  return id.startsWith(RULE_SELECTION_PREFIX);
}

export function ruleSelectionItemId(id: string): string {
  return id.slice(RULE_SELECTION_PREFIX.length);
}

export function selectableEntryIds(
  items: readonly CardViewerItem[],
  entryByItemId: ReadonlyMap<string, ListEntryDetailResponse>,
): string[] {
  const ids = items.flatMap((item) => {
    const entry = entryByItemId.get(item.id);
    return entry ? [entrySelectionId(item.id, entry)] : [];
  });
  return [...new Set(ids)];
}

export function resolveCopyMoveTarget(
  entryByItemId: ReadonlyMap<string, ListEntryDetailResponse>,
  selected: ReadonlySet<string>,
  copyId: string,
): string[] {
  const copyIdBySelectionId = new Map<string, string>();
  for (const [itemId, entry] of entryByItemId) {
    if (entry.kind === "copy") {
      copyIdBySelectionId.set(entrySelectionId(itemId, entry), entry.copyId);
    }
  }
  const selectionId = [...copyIdBySelectionId].find(([, id]) => id === copyId)?.[0];
  if (selectionId === undefined || !selected.has(selectionId)) {
    return [copyId];
  }
  return [...copyIdBySelectionId].flatMap(([id, selectedCopyId]) =>
    selected.has(id) ? [selectedCopyId] : [],
  );
}

/** The printing each selectable entry shows, keyed by selection id. */
export function buildPrintingByEntryId(
  items: readonly CardViewerItem[],
  entryByItemId: ReadonlyMap<string, ListEntryDetailResponse>,
): Map<string, Printing> {
  const result = new Map<string, Printing>();
  for (const item of items) {
    const entry = entryByItemId.get(item.id);
    if (!entry) {
      continue;
    }
    const selectionId = entrySelectionId(item.id, entry);
    if (!result.has(selectionId)) {
      result.set(selectionId, item.printing);
    }
  }
  return result;
}

export function buildEntryByKey(
  kind: ListKind,
  entries: readonly ListEntryDetailResponse[],
): Map<string, ListEntryDetailResponse> {
  const result = new Map<string, ListEntryDetailResponse>();
  if (kind === "copy") {
    return result;
  }
  for (const entry of entries) {
    if (kind === "card" && entry.kind === "card") {
      result.set(entry.cardId, entry);
    } else if (kind === "printing" && entry.kind === "printing") {
      result.set(entry.printingId, entry);
    }
  }
  return result;
}
