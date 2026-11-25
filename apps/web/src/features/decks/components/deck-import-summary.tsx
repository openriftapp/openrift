import { deckCardCount, validateDeck } from "@openrift/shared/deck-rules";
import { requiredZoneProgress } from "@openrift/shared/deck-zones";
import type { DeckFormatConfig } from "@openrift/shared/types/api/deck";
import type { DeckFormat } from "@openrift/shared/types/enums";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { TagIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useCustomTagAssignments } from "@/features/collections/hooks/use-custom-tag-assignments";
import { DeckDomainBar } from "@/features/decks/components/deck-domain-bar";
import { DeckFormatBadge } from "@/features/decks/components/deck-format-badge";
import { DeckMissingCardsDialog } from "@/features/decks/components/deck-missing-cards-dialog";
import { DeckOwnershipNote } from "@/features/decks/components/deck-ownership-note";
import { DeckOwnershipBody } from "@/features/decks/components/deck-ownership-panel";
import { useDeckStats } from "@/features/decks/hooks/use-deck-stats";
import { useRuleCardJudge } from "@/features/decks/hooks/use-rule-card-judge";
import { useViewerDeckOwnership } from "@/features/decks/hooks/use-viewer-deck-ownership";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { toDeckBuilderCard, toRuleEngineCard } from "@/features/decks/lib/deck-builder-card";
import type { ImportedDeckCard } from "@/features/decks/lib/deck-import-cards";
import { useChampionIdentifierTags } from "@/hooks/use-enums";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatterForMarketplace } from "@/lib/format";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

/** Drops rows whose card is missing from the catalog: type narrowing, not a real case. */
export function toBuilderCards(
  cards: ImportedDeckCard[],
  cardsById: ReturnType<typeof useCards>["cardsById"],
): DeckBuilderCard[] {
  const builderCards: DeckBuilderCard[] = [];
  for (const card of cards) {
    const builderCard = toDeckBuilderCard(card, cardsById);
    if (builderCard) {
      builderCards.push(builderCard);
    }
  }
  return builderCards;
}

/**
 * Uses the same logic the deck page uses (useDeckStats, computeDeckOwnership,
 * validateDeck), so the preview and the deck it creates can never disagree.
 */
export function DeckImportSummary({
  cards,
  format,
  formatConfig,
  deckName,
  isLoggedIn,
}: {
  cards: ImportedDeckCard[];
  format: DeckFormat;
  /** null for a new deck. */
  formatConfig: DeckFormatConfig | null;
  deckName: string;
  isLoggedIn: boolean;
}) {
  const { cardsById } = useCards();
  const championIdentifierTags = useChampionIdentifierTags();
  const customTagAssignments = useCustomTagAssignments();
  const judge = useRuleCardJudge();
  const marketplaceOrder = useDisplayStore((state) => state.marketplaceOrder);
  const marketplace: Marketplace = marketplaceOrder[0];
  const hydrated = useHydrated();
  const [missingOpen, setMissingOpen] = useState(false);

  const builderCards = toBuilderCards(cards, cardsById);
  const ownershipData = useViewerDeckOwnership(builderCards, {
    enabled: hydrated,
    isLoggedIn,
    marketplace,
  });
  const stats = useDeckStats(builderCards);
  const violations = validateDeck({
    format,
    formatConfig,
    cards: builderCards.map((card) => toRuleEngineCard(card, customTagAssignments, judge)),
    championIdentifierTags,
  });
  const totalCards = deckCardCount(builderCards);
  const { progress: requiredProgress, total: requiredTotal } = requiredZoneProgress(
    builderCards,
    format,
  );

  if (builderCards.length === 0) {
    return null;
  }

  return (
    <>
      <Callout className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-sm font-medium tabular-nums">
            {m.common_cards({ count: totalCards })}
          </span>
          <div className="min-w-0 flex-1">
            <DeckDomainBar distribution={stats.domainDistribution} />
          </div>
          <DeckFormatBadge
            format={format}
            totalCards={totalCards}
            requiredProgress={requiredProgress}
            requiredTotal={requiredTotal}
            isValid={violations.length === 0}
            violations={violations}
          />
        </div>

        {/* Not a sign-in link: leaving now would drop the parsed list. An
            import finished here is claimed on the next sign-in anyway. */}
        {isLoggedIn ? (
          ownershipData && (
            <DeckOwnershipBody
              data={ownershipData}
              marketplace={marketplace}
              onViewMissing={() => setMissingOpen(true)}
            />
          )
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">{m.decks_import_sign_in_hint()}</p>
            {ownershipData?.deckValue !== undefined && (
              <Button
                variant="outline"
                size="sm"
                className="w-full tabular-nums"
                onClick={() => setMissingOpen(true)}
              >
                <TagIcon className="size-3.5" />
                {formatterForMarketplace(marketplace)(ownershipData.deckValue)}
                <span className="text-muted-foreground">{m.decks_import_view_prices()}</span>
              </Button>
            )}
          </div>
        )}
        <DeckOwnershipNote enabled={hydrated} />
      </Callout>

      {ownershipData && (
        <DeckMissingCardsDialog
          open={missingOpen}
          onOpenChange={setMissingOpen}
          missingCards={ownershipData.missingCards}
          totalMissingValue={ownershipData.missingValue}
          marketplace={marketplace}
          mode={isLoggedIn ? "missing" : "prices"}
          deckName={deckName}
        />
      )}
    </>
  );
}
