import type { DeckListItemResponse } from "@openrift/shared/types/api/deck";

import { m } from "@/paraglide/messages.js";

import { DeckListRow } from "./deck-list-row";

export function DeckVariantsPanel({
  items,
  folderLabels,
}: {
  items: DeckListItemResponse[];
  folderLabels?: Record<string, string>;
}) {
  return (
    <section
      aria-label={m.decks_dialog_variants_title()}
      className="bg-muted/30 ring-primary/40 col-span-full flex flex-col gap-1.5 rounded-lg p-2 ring-1"
    >
      {items.map((item) => (
        <DeckListRow key={item.deck.id} item={item} folderLabels={folderLabels} showPrimary />
      ))}
    </section>
  );
}
