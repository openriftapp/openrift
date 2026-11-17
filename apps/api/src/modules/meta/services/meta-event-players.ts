import type { Repos } from "../../../deps.js";
import { withUniqueShareToken } from "../../../lib/share-token.js";
import type { MetaReplacedDeckInput } from "../repositories/meta-decks.js";
import type { MetaEventPlayerInput } from "../repositories/meta-players.js";

interface CreatedMetaEventPlayer {
  metaEventPlayerId: string;
  deckId: string | null;
  shareToken: string | null;
}

export async function createMetaEventPlayer(
  meta: Repos["meta"],
  input: MetaEventPlayerInput,
): Promise<CreatedMetaEventPlayer | undefined> {
  const { deck, ...player } = input;
  if (deck === null) {
    const created = await meta.createPlayer(player, null);
    return created === undefined ? undefined : { ...created, shareToken: null };
  }
  // Retry only catches uq_decks_share_token violations; a violation from
  // deck_cards or the standings insert must propagate as a real fault.
  return withUniqueShareToken<CreatedMetaEventPlayer | undefined>(
    async (shareToken) => {
      const created = await meta.createPlayer(player, { deck, shareToken });
      return created === undefined ? undefined : { ...created, shareToken };
    },
    { constraint: "uq_decks_share_token" },
  );
}

export function setMetaPlayerList(
  meta: Repos["meta"],
  metaEventPlayerId: string,
  deck: MetaReplacedDeckInput,
  options?: { preserveName?: boolean },
): Promise<{ deckId: string } | undefined> {
  // Never rotates the share token: an already-published link must keep resolving.
  return withUniqueShareToken(
    (shareToken) => meta.setPlayerDeck(metaEventPlayerId, deck, shareToken, options),
    { constraint: "uq_decks_share_token" },
  );
}
