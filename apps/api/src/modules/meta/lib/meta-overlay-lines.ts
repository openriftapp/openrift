import type { Repos } from "../../../deps.js";
import { badRequest } from "../../../errors.js";

export interface OverlayLine {
  lineNumber: number;
  zone: string;
  quantity: number;
  cardName: string;
  cardId: string;
  preferredPrintingId: string | null;
}

/**
 * The submitted lines as overlay card rows, every id resolved to its canonical
 * name so promotion and the queue read the same words the catalog uses.
 */
export async function toOverlayLines(
  repos: Pick<Repos, "catalog">,
  cards: readonly {
    cardId: string;
    zone: string;
    quantity: number;
    preferredPrintingId?: string | null;
  }[],
): Promise<OverlayLine[]> {
  const names = await repos.catalog.cardNamesByIds(cards.map((card) => card.cardId));
  return cards.map((card, lineNumber) => {
    const cardName = names.get(card.cardId);
    if (cardName === undefined) {
      throw badRequest("A card in the list no longer exists.");
    }
    return {
      lineNumber,
      zone: card.zone,
      quantity: card.quantity,
      cardName,
      cardId: card.cardId,
      preferredPrintingId: card.preferredPrintingId ?? null,
    };
  });
}
