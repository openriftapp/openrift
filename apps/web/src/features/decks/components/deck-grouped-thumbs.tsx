import type { DeckZone } from "@openrift/shared/types/enums";

import type { CardOpenTarget, HoverHandler } from "@/features/cards/lib/card-row-interactions";
import { DeckCardGroupHeader } from "@/features/decks/components/deck-card-group-header";
import { ZoneThumb } from "@/features/decks/components/deck-zone-thumbs";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { deckCardKey } from "@/features/decks/lib/deck-builder-card";
import type { DeckCardGroup, DeckOverviewGroup } from "@/features/decks/lib/deck-card-group";
import { copyRowGroups } from "@/features/decks/lib/deck-card-group";
import type { CopyViewFor } from "@/features/decks/lib/deck-overview-derive";
import { expandCopies } from "@/features/decks/lib/deck-overview-derive";
import type { OwnershipBandSegments } from "@/features/decks/lib/deck-ownership-band";
import type { CardOwnership } from "@/features/decks/lib/deck-ownership-types";
import type { StatsFocus } from "@/features/decks/lib/deck-stats-focus";
import { cardMatchesStatsFocus } from "@/features/decks/lib/deck-stats-focus";

export function GroupedThumbs({
  deckId,
  bandByCardKey,
  priceTextByCardKey,
  addRoomByCardKey,
  resolveHoverPrintingId,
  showAllCopies,
  statsFocus,
  zone,
  groups,
  sortCards,
  groupBy,
  groupDir,
  copyViewFor,
  getOwnershipEntry,
  isLandscape,
  onHoverCard,
  getThumbnail,
  readOnly,
  onCardClick,
}: {
  deckId: string;
  bandByCardKey: ReadonlyMap<string, OwnershipBandSegments>;
  priceTextByCardKey: ReadonlyMap<string, string>;
  addRoomByCardKey: ReadonlyMap<string, number>;
  resolveHoverPrintingId: (cardId: string, preferredPrintingId: string | null) => string | null;
  showAllCopies: boolean;
  statsFocus: StatsFocus | null;
  zone: DeckZone;
  groups: DeckCardGroup[];
  sortCards: (cards: DeckBuilderCard[]) => DeckBuilderCard[];
  groupBy: DeckOverviewGroup;
  groupDir: "asc" | "desc";
  copyViewFor?: CopyViewFor;
  getOwnershipEntry: (card: DeckBuilderCard) => CardOwnership | undefined;
  isLandscape: boolean;
  onHoverCard?: HoverHandler;
  getThumbnail: (cardId: string, preferredPrintingId: string | null) => string | undefined;
  readOnly?: boolean;
  onCardClick?: (card: CardOpenTarget) => void;
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
            {rows.map(({ card, copyIndex }) => {
              const copy = copyIndex === null ? undefined : copyViewFor?.(card, copyIndex);
              const thumbnail =
                copy?.thumbnail ?? getThumbnail(card.cardId, card.preferredPrintingId);
              if (!thumbnail) {
                return null;
              }
              return (
                <ZoneThumb
                  key={`${deckCardKey(card)}-${copyIndex ?? "stack"}`}
                  deckId={deckId}
                  card={card}
                  band={bandByCardKey.get(deckCardKey(card))}
                  priceText={copy ? copy.priceText : priceTextByCardKey.get(deckCardKey(card))}
                  addRoom={addRoomByCardKey.get(deckCardKey(card)) ?? 0}
                  hoverPrintingId={
                    copy?.printingId ??
                    resolveHoverPrintingId(card.cardId, card.preferredPrintingId)
                  }
                  copyIndex={copyIndex}
                  showsCopyPrinting={copy !== undefined}
                  dimmed={statsFocus !== null && !cardMatchesStatsFocus(card, statsFocus)}
                  zone={zone}
                  thumbnail={thumbnail}
                  isLandscape={isLandscape}
                  onHoverCard={onHoverCard}
                  readOnly={readOnly}
                  onCardClick={onCardClick}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
