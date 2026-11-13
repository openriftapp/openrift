import type { MetaDeckDetailResponse } from "@openrift/shared/types/api/meta";
import { useNavigate } from "@tanstack/react-router";

import type { CloneSharedDeckInput } from "@/features/decks/hooks/use-decks";
import { useCloneSharedDeck } from "@/features/decks/hooks/use-decks";
import {
  createLocalDeck,
  setLocalDeckCards,
  updateLocalDeck,
} from "@/features/decks/lib/local-decks-collection";
import { useUserId } from "@/hooks/use-session";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

interface CopyArchivedDeckInput {
  token: string;
  deck: MetaDeckDetailResponse["deck"];
  cards: MetaDeckDetailResponse["cards"];
  extraCards?: MetaDeckDetailResponse["cards"];
  name: string;
  description: string;
}

function cloneInput(
  base: { token: string; name: string; description: string },
  extraCards: CopyArchivedDeckInput["extraCards"] = [],
): CloneSharedDeckInput {
  if (extraCards.length === 0) {
    return base;
  }
  return {
    ...base,
    extraCards: extraCards.map((card) => ({
      cardId: card.cardId,
      zone: card.zone,
      quantity: card.quantity,
    })),
  };
}

export interface CopyArchivedDeck {
  copy: (input: CopyArchivedDeckInput) => Promise<void>;
  isPending: boolean;
  isLoggedIn: boolean;
  label: string;
}

/**
 * Signed in duplicates the deck server-side, signed out builds the same list as
 * a browser-local deck. Which branch runs follows the deck importer: the
 * presence of a user id, not a session load state.
 */
export function useCopyArchivedDeck(): CopyArchivedDeck {
  const userId = useUserId();
  const isLoggedIn = userId !== null;
  const cloneMutation = useCloneSharedDeck();
  const navigate = useNavigate();

  const copy = async ({
    token,
    deck,
    cards,
    extraCards = [],
    name,
    description,
  }: CopyArchivedDeckInput) => {
    if (!isLoggedIn) {
      const localId = createLocalDeck(deck.format, name);
      // createLocalDeck starts with formatConfig null, so a Custom-Region copy would lose its regions.
      updateLocalDeck(localId, {
        description,
        formatConfig: deck.formatConfig,
        links: deck.links,
      });
      setLocalDeckCards(
        localId,
        [...cards, ...extraCards].map((card) => ({
          zone: card.zone,
          cardId: card.cardId,
          quantity: card.quantity,
          preferredPrintingId: card.preferredPrintingId,
        })),
      );
      void navigate({ to: "/decks/$deckId", params: { deckId: localId } });
      return;
    }
    const input = cloneInput({ token, name, description }, extraCards);
    let cloned: Awaited<ReturnType<typeof cloneMutation.mutateAsync>> | undefined;
    const ok = await runReportedMutation(async () => {
      cloned = await cloneMutation.mutateAsync(input);
    });
    if (ok && cloned) {
      void navigate({ to: "/decks/$deckId", params: { deckId: cloned.deckId } });
    }
  };

  return {
    copy,
    isPending: cloneMutation.isPending,
    isLoggedIn,
    label: isLoggedIn ? m.decks_menu_copy_to_my_decks() : m.decks_menu_open_in_builder(),
  };
}
