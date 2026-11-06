import { legendDisplayName } from "@openrift/shared/card-name";
import type { DeckZone } from "@openrift/shared/types/enums";
import { toast } from "sonner";

import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { m } from "@/paraglide/messages.js";

export interface RelaxedAddOutcome {
  rule:
    | "copyLimit"
    | "battlefieldCap"
    | "battlefieldDuplicate"
    | "legendOptionsCap"
    | "runeCap"
    | "runeSwap";
  card: DeckBuilderCard;
  zone: DeckZone;
  quantity: number;
  total: number;
  limit: number;
  swappedOut?: DeckBuilderCard;
}

function nameOf(card: DeckBuilderCard): string {
  return legendDisplayName({ name: card.cardName, types: card.cardTypes, tags: card.tags });
}

export function relaxedAddMessage(notice: RelaxedAddOutcome): string {
  const card = nameOf(notice.card);
  switch (notice.rule) {
    case "copyLimit": {
      return m.decks_workbench_warn_copies({ card, count: notice.total, limit: notice.limit });
    }
    case "battlefieldCap": {
      return m.decks_workbench_warn_battlefields({ count: notice.total, limit: notice.limit });
    }
    case "battlefieldDuplicate": {
      return m.decks_workbench_warn_battlefield_duplicate({ card });
    }
    case "legendOptionsCap": {
      return m.decks_workbench_warn_legend_options({ count: notice.total, limit: notice.limit });
    }
    case "runeCap": {
      return m.decks_workbench_warn_runes({ count: notice.total, limit: notice.limit });
    }
    case "runeSwap": {
      return m.decks_workbench_rune_swap({
        added: card,
        removed: notice.swappedOut ? nameOf(notice.swappedOut) : "",
      });
    }
  }
}

const openToasts = new Set<string | number>();

export function showRelaxedAddToast(
  notice: RelaxedAddOutcome,
  handlers: { undo: () => void; keepBoth?: () => void },
): void {
  const message = relaxedAddMessage(notice);
  const action = { label: m.decks_editor_undo(), onClick: handlers.undo };
  const onDismiss = (shown: { id: string | number }) => openToasts.delete(shown.id);
  const id =
    notice.rule === "runeSwap"
      ? toast(message, {
          action,
          cancel: handlers.keepBoth
            ? {
                label: m.decks_workbench_keep_both({ count: notice.total + 1 }),
                onClick: handlers.keepBoth,
              }
            : undefined,
          onDismiss,
          onAutoClose: onDismiss,
        })
      : toast.warning(message, { action, onDismiss, onAutoClose: onDismiss });
  openToasts.add(id);
}

// Their undo closures write to the deck they came from, so they must not outlive its editor.
export function dismissRelaxedAddToasts(): void {
  for (const id of openToasts) {
    toast.dismiss(id);
  }
  openToasts.clear();
}
