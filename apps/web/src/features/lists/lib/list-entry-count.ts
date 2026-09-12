import type { ListKind } from "@openrift/shared/types/api/list";

const KIND_NOUN: Record<ListKind, { singular: string; plural: string }> = {
  card: { singular: "Card", plural: "Cards" },
  printing: { singular: "Printing", plural: "Printings" },
  copy: { singular: "Copy", plural: "Copies" },
};

export function listEntryCountLabel(kind: ListKind, entryCount: number): string {
  const noun = entryCount === 1 ? KIND_NOUN[kind].singular : KIND_NOUN[kind].plural;
  return `${entryCount} ${noun}`;
}
