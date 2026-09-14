import type { MoveListEntriesResolution } from "@openrift/shared/contracts/lists";
import type { ListIntent, ListKind } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";

const KIND_RANK: Record<ListKind, number> = { card: 0, printing: 1, copy: 2 };

export type MoveMode = "move" | "copy";
export type MovePick = "none" | "printing" | "copies";
export type MoveResolution = Omit<MoveListEntriesResolution, "entryId">;

/** The entry being moved; a `ListEntryDragData` satisfies it directly. */
export interface MoveEntrySubject {
  entryIds: string[];
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
