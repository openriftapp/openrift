import type { ReactNode } from "react";

import { DeckCardGroupHeader } from "@/features/decks/components/deck-card-group-header";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import type { DeckCardGroup, DeckOverviewGroup } from "@/features/decks/lib/deck-card-group";
import { copyRowGroups } from "@/features/decks/lib/deck-card-group";
import { expandCopies } from "@/features/decks/lib/deck-overview-derive";
import type { CardOwnership } from "@/features/decks/lib/deck-ownership-types";

export function GroupedThumbs({
  showAllCopies,
  groups,
  sortCards,
  groupBy,
  groupDir,
  getOwnershipEntry,
  renderThumb,
}: {
  showAllCopies: boolean;
  groups: DeckCardGroup[];
  sortCards: (cards: DeckBuilderCard[]) => DeckBuilderCard[];
  groupBy: DeckOverviewGroup;
  groupDir: "asc" | "desc";
  getOwnershipEntry: (card: DeckBuilderCard) => CardOwnership | undefined;
  renderThumb: (card: DeckBuilderCard, copyIndex: number | null) => ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
      {copyRowGroups(groups, (cards) => expandCopies(sortCards(cards), showAllCopies), {
        splitByCopy: showAllCopies && groupBy === "ownership",
        dir: groupDir,
        getEntry: getOwnershipEntry,
      }).map(({ group, count, rows }) => (
        <div key={group.key} className="flex flex-col gap-1.5">
          <DeckCardGroupHeader group={group} groupBy={groupBy} count={count} />
          <div className="flex flex-wrap items-center gap-1.5">
            {rows.map(({ card, copyIndex }) => renderThumb(card, copyIndex))}
          </div>
        </div>
      ))}
    </div>
  );
}
