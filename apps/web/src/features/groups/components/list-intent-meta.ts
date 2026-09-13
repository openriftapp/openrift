import type { ListIntent, ListKind } from "@openrift/shared/types/api/list";
import { FolderIcon, HandshakeIcon, HeartIcon } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { m } from "@/paraglide/messages.js";

export const LIST_INTENT_ICON: Record<ListIntent, ComponentType<SVGProps<SVGSVGElement>>> = {
  wish: HeartIcon,
  trade: HandshakeIcon,
  organize: FolderIcon,
};

export function listIntentNoun(intent: ListIntent): string {
  switch (intent) {
    case "wish": {
      return m.lists_intent_noun_wish();
    }
    case "trade": {
      return m.lists_intent_noun_trade();
    }
    case "organize": {
      return m.lists_intent_noun_organize();
    }
  }
}

export function listKindNoun(kind: ListKind, count: number): string {
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
