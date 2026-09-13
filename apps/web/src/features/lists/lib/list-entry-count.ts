import type { ListKind } from "@openrift/shared/types/api/list";

import { m } from "@/paraglide/messages.js";

function kindNoun(kind: ListKind, count: number): string {
  switch (kind) {
    case "card": {
      return m.lists_kind_card({ count });
    }
    case "printing": {
      return m.lists_kind_printing({ count });
    }
    case "copy": {
      return m.lists_kind_copy({ count });
    }
  }
}

export function listEntryCountLabel(kind: ListKind, entryCount: number): string {
  return `${entryCount} ${kindNoun(kind, entryCount)}`;
}
