import { decksContract } from "@openrift/shared/contracts/decks";
import type { DeckCardResponse } from "@openrift/shared/types/api/deck";
import type { DeckZone } from "@openrift/shared/types/enums";
import { createServerFn } from "@tanstack/react-start";

import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export const saveDeckCardsFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      deckId: string;
      cards: {
        cardId: string;
        zone: DeckZone;
        quantity: number;
        preferredPrintingId: string | null;
      }[];
    }) => input,
  )
  .middleware([withCookies])
  .handler(({ context, data }): Promise<{ cards: DeckCardResponse[] }> =>
    apiOrpcClient(decksContract, context.cookie).replaceCards({
      id: data.deckId,
      cards: data.cards,
    }),
  );
