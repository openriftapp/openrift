import type { MetaDeckSummary } from "@openrift/shared/types/api/meta";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { MetaArchiveDeckTile } from "@/features/meta/components/meta-archive-deck-tile";
import { DECK_GRID_LIMIT } from "@/features/meta/lib/meta-deck-grid";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

type MetaArchivedDecksSubject = "legend" | "player";

function emptyDescriptions(): Record<MetaArchivedDecksSubject, string> {
  return {
    legend: m.meta_archived_decks_empty_legend(),
    player: m.meta_archived_decks_empty_player(),
  };
}

/** `total` may exceed `decks.length`; `onShowAll` fetches the rest. */
export function MetaArchivedDecks({
  decks,
  total,
  subject,
  onShowAll,
}: {
  decks: readonly MetaDeckSummary[];
  total: number;
  subject: MetaArchivedDecksSubject;
  onShowAll?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const marketplace = useDisplayStore((state) => state.marketplaceOrder[0]);
  const shown = expanded ? decks : decks.slice(0, DECK_GRID_LIMIT);
  // "Show all" is a one-shot: once it has run the grid holds everything the
  // scope left, even where that is fewer rows than `total` promised.
  const remaining = expanded ? 0 : total - shown.length;

  if (decks.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <Heading>{m.meta_archived_decks_heading()}</Heading>
        <Empty>
          <EmptyHeader>
            <EmptyDescription>{emptyDescriptions()[subject]}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Heading>{m.meta_archived_decks_heading()}</Heading>
        {(remaining > 0 || expanded) && (
          <Button
            variant="link"
            className="h-auto p-0 text-sm font-medium"
            onClick={() => {
              setExpanded(!expanded);
              if (!expanded) {
                onShowAll?.();
              }
            }}
          >
            {expanded
              ? m.meta_show_fewer()
              : m.meta_show_all_n({ count: total.toLocaleString("en-US") })}
          </Button>
        )}
      </div>
      <div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((deck) => (
            <li key={deck.deckId}>
              <MetaArchiveDeckTile deck={deck} marketplace={marketplace} showEvent />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
