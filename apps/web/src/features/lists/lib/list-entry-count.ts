import type { ListKind } from "@openrift/shared/types/api/list";

import { m } from "@/paraglide/messages.js";

function kindNoun(kind: ListKind, count: number): string {
  switch (kind) {
    case "card": {
      return count === 1 ? m.lists_kind_card_one() : m.lists_kind_card_other();
    }
    case "printing": {
      return count === 1 ? m.lists_kind_printing_one() : m.lists_kind_printing_other();
    }
    case "copy": {
      return count === 1 ? m.lists_kind_copy_one() : m.lists_kind_copy_other();
    }
  }
}

export function listEntryCountLabel(kind: ListKind, entryCount: number): string {
  return `${entryCount} ${kindNoun(kind, entryCount)}`;
}
