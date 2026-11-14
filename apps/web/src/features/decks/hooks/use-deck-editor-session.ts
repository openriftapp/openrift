import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useCards } from "@/features/cards/hooks/use-cards";
import { usePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import type { CardOpenTarget } from "@/features/cards/lib/card-row-interactions";
import { useDeckBuildingCounts } from "@/features/collections/hooks/use-owned-count";
import { useDeckCards, useDeckViolations } from "@/features/decks/hooks/use-deck-builder";
import { useDeckDraftHydrated, useDeckSaveStatus } from "@/features/decks/hooks/use-deck-draft";
import { useDeckItems } from "@/features/decks/hooks/use-deck-items";
import { useDeckOwnership } from "@/features/decks/hooks/use-deck-ownership";
import { useDeckDetail } from "@/features/decks/hooks/use-decks";
import { useIsLocalDeck } from "@/features/decks/hooks/use-local-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { toDeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { buildRunesByDomain } from "@/features/decks/lib/deck-runes-by-domain";
import { useDeckBenchSessionStore } from "@/features/decks/stores/deck-bench-session-store";
import { useDeckBuilderUiStore } from "@/features/decks/stores/deck-builder-ui-store";
import { flushDeckDraft, hydrateDeckDraft } from "@/features/decks/stores/deck-draft-store";
import { useIncomingTradeCounts } from "@/features/groups/hooks/use-card-trades";
import { useBorrowedCounts } from "@/features/groups/hooks/use-loans";
import { useRegisterQuickAdd } from "@/hooks/use-command-palette";
import { useSession, useUserId } from "@/hooks/use-session";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";
import { useSelectionStore } from "@/stores/selection-store";

export function useDeckEditorSession(deckId: string) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  // A browser-local deck keys its draft under a "local" scope so it works signed out.
  const isLocal = useIsLocalDeck(deckId);
  const scope = isLocal ? "local" : (userId ?? "");
  const { data } = useDeckDetail(deckId);
  const { cardsById, allPrintings } = useCards();
  const { getPreferredPrinting } = usePreferredPrinting();
  const hydrated = useDeckDraftHydrated(queryClient, scope, deckId);
  const deckCards = useDeckCards(deckId);
  const saveStatus = useDeckSaveStatus(queryClient, scope, deckId);
  const resetUi = useDeckBuilderUiStore((state) => state.reset);
  const setRunesByDomain = useDeckBuilderUiStore((state) => state.setRunesByDomain);
  const clearBenchSession = useDeckBenchSessionStore((state) => state.clear);

  const { data: session } = useSession();
  const signedIn = Boolean(session?.user);
  const { data: deckCounts } = useDeckBuildingCounts(signedIn, data.deck.collectionId);
  const { data: borrowedCounts } = useBorrowedCounts(signedIn);
  const { data: incomingCounts } = useIncomingTradeCounts(signedIn);
  const marketplaceOrder = useDisplayStore((state) => state.marketplaceOrder);
  const marketplace = marketplaceOrder[0];
  const editorViolations = useDeckViolations(deckId, data.deck.format, data.deck.formatConfig);
  useRegisterQuickAdd({ key: `deck:${deckId}`, label: m.decks_editor_quick_add_label() });
  const ownershipData = useDeckOwnership(
    deckCards,
    allPrintings,
    deckCounts?.available,
    marketplace,
    deckCounts?.locked,
    borrowedCounts,
    deckCounts && {
      loaned: deckCounts.lockedLoaned,
      reserved: deckCounts.lockedReserved,
      excluded: deckCounts.lockedExcluded,
    },
    incomingCounts,
  );

  useEffect(() => {
    if (allPrintings.length === 0) {
      return;
    }
    setRunesByDomain(buildRunesByDomain(allPrintings));
  }, [allPrintings, setRunesByDomain]);

  useEffect(() => {
    if (data && !hydrated) {
      const builderCards = data.cards
        .map((card) => toDeckBuilderCard(card, cardsById))
        .filter((card): card is DeckBuilderCard => card !== null);
      hydrateDeckDraft(queryClient, scope, deckId, builderCards);
    }
  }, [data, deckId, hydrated, queryClient, scope, cardsById]);

  // The draft stays cached per user, so re-entering the deck skips hydration.
  useEffect(
    () => () => {
      resetUi();
    },
    [resetUi],
  );

  useEffect(
    () => () => {
      flushDeckDraft(queryClient, scope, deckId);
    },
    [queryClient, scope, deckId],
  );

  useEffect(() => () => clearBenchSession(deckId), [clearBenchSession, deckId]);

  const unsavedWarning = saveStatus.isDirty || saveStatus.isSaving;
  useEffect(() => {
    if (!unsavedWarning) {
      return;
    }
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    globalThis.addEventListener("beforeunload", handler);
    return () => globalThis.removeEventListener("beforeunload", handler);
  }, [unsavedWarning]);

  const { items: deckItems, printingsByCardId } = useDeckItems(deckCards);

  const openOverviewCard = (card: CardOpenTarget) => {
    const printing = getPreferredPrinting(card.cardId, card.preferredPrintingId);
    if (!printing) {
      return;
    }
    useSelectionStore.getState().selectCard(printing, deckItems, "card", { zone: card.zone });
  };

  return {
    data,
    isLocal,
    hydrated,
    deckCards,
    saveStatus,
    deckCounts,
    ownershipData,
    marketplace,
    editorViolations,
    deckItems,
    printingsByCardId,
    openOverviewCard,
  };
}
