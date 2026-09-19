import type { MoveListEntriesResolution } from "@openrift/shared/contracts/lists";
import type {
  ListEntryDetailResponse,
  ListIntent,
  ListKind,
} from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";

const KIND_RANK: Record<ListKind, number> = { card: 0, printing: 1, copy: 2 };

export type MoveMode = "move" | "copy";
export type MovePick = "none" | "printing" | "copies";
export type MoveResolution = Omit<MoveListEntriesResolution, "entryId">;

/** A rule-derived entry has no `list_entries` row; a copy adds a fresh entry from these ids. */
export interface RuleEntryRef {
  kind: ListKind;
  printingId?: string;
  copyId?: string;
}

export function ruleEntryRef(entry: ListEntryDetailResponse): RuleEntryRef {
  if (entry.kind === "card") {
    return { kind: "card" };
  }
  if (entry.kind === "printing") {
    return { kind: "printing", printingId: entry.printingId };
  }
  return { kind: "copy", printingId: entry.printingId, copyId: entry.copyId };
}

export interface ListEntryInput {
  cardId?: string;
  printingId?: string;
  copyId?: string;
  quantity?: number;
}

/** The bulk-add rows that copy a rule-derived entry onto a list of `targetKind`. */
export function ruleEntryCopyInputs(
  subject: Pick<MoveEntrySubject, "printing" | "totalQuantity"> & { ruleEntry: RuleEntryRef },
  targetKind: ListKind,
  resolution: MoveResolution | null,
): ListEntryInput[] {
  const { ruleEntry, printing, totalQuantity } = subject;
  if (targetKind === "copy") {
    const copyIds = ruleEntry.copyId ? [ruleEntry.copyId] : (resolution?.copyIds ?? []);
    return copyIds.map((copyId) => ({ copyId }));
  }
  if (targetKind === "printing") {
    const printingId = ruleEntry.printingId ?? resolution?.printingId;
    return printingId ? [{ printingId, quantity: totalQuantity }] : [];
  }
  return [{ cardId: printing.cardId, quantity: totalQuantity }];
}

/** The entry being moved; a `ListEntryDragData` satisfies it directly. */
export interface MoveEntrySubject {
  /** Every dragged tile when a selection was dropped; absent for a menu action. */
  selectionIds?: string[];
  /** Empty for a rule-derived entry, which carries `ruleEntry` instead and can only be copied. */
  entryIds: string[];
  ruleEntry?: RuleEntryRef;
  sourceKind: ListKind;
  sourceIntent: ListIntent;
  totalQuantity: number;
  printing: Printing;
  cardName: string;
}

export interface MoveEntryTarget {
  listName: string;
  listKind: ListKind;
  listIntent: ListIntent;
}

/** What the user must supply for a list-entry move: nothing for same-or-narrower kinds. */
export function movePickFor(sourceKind: ListKind, targetKind: ListKind): MovePick {
  if (KIND_RANK[targetKind] <= KIND_RANK[sourceKind]) {
    return "none";
  }
  return targetKind === "copy" ? "copies" : "printing";
}

export function moveNeedsDialog(
  source: { kind: ListKind; intent: ListIntent },
  target: { kind: ListKind; intent: ListIntent },
): boolean {
  return source.intent !== target.intent || movePickFor(source.kind, target.kind) !== "none";
}

/**
 * Entries that track cards or printings can create new owned copies in a
 * collection. Copy-kind entries already point at copies, so they move instead.
 */
export function entryAddsCopies(kind: ListKind): boolean {
  return kind !== "copy";
}

export interface AddEntryToCollectionSubject {
  sourceKind: ListKind;
  totalQuantity: number;
  printing: Printing;
  cardName: string;
}

export interface AddEntryToCollectionRequest {
  /** Several when the action ran on a selection; the dialog picks a printing per card. */
  subjects: AddEntryToCollectionSubject[];
  /** Set by a drop onto a sidebar collection; the menu path picks one in the dialog. */
  collectionId?: string;
}
