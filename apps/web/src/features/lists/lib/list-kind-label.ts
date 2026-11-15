import type { ListKind } from "@openrift/shared/types/api/list";

import { m } from "@/paraglide/messages.js";

export function listKindLabel(kind: ListKind): string {
  switch (kind) {
    case "card": {
      return m.lists_create_kind_cards();
    }
    case "printing": {
      return m.lists_create_kind_printings();
    }
    case "copy": {
      return m.lists_create_kind_copies();
    }
  }
}
