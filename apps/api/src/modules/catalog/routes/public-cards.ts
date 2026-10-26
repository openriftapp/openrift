import { cardsContract } from "@openrift/shared/contracts/cards";
import type {
  CardDetailResponse,
  CardRelatedResponse,
  CatalogResponseCardValue,
} from "@openrift/shared/types/api/catalog";
import { implement } from "@orpc/server";

import { requireUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import {
  buildCardsResponse,
  loadPrintingDecorations,
  presentPrintingValues,
  referencedChannels,
  referencedMarkers,
} from "../lib/printing-presenters.js";

const os = implement(cardsContract).$context<ApiContext>().use(requireUser);

const RELATED_CARDS_LIMIT = 8;

/**
 * Prices are not inlined; they are served separately by `/prices`.
 */
export const cardsRouter = {
  detail: os.detail.handler(async ({ input, context, errors }): Promise<CardDetailResponse> => {
    const repos = context.repos;
    const { catalog } = repos;

    const card = await catalog.cardBySlug(input.cardSlug);
    if (!card) {
      throw errors.NOT_FOUND({ message: `Card not found: ${input.cardSlug}` });
    }

    const cardRows = await catalog.printingsByCardId(card.id);
    const printingIds = [...new Set(cardRows.map((p) => p.printingId))];
    const doubleSidedIds = [
      ...new Set(cardRows.filter((p) => p.otherSide !== null).map((p) => p.printingId)),
    ];
    const slugByPrinting = new Map(cardRows.map((p) => [p.printingId, p.slug]));
    const [otherSideRows, imageRows, products, decorations] = await Promise.all([
      catalog.printingsByIds(doubleSidedIds),
      catalog.printingImagesByPrintingIds(printingIds),
      repos.products.productsForCard(card.id),
      loadPrintingDecorations(repos, printingIds),
    ]);
    const seenFaces = new Set(cardRows.map((p) => p.faceId));
    const printingRows = [
      ...cardRows,
      ...otherSideRows
        .filter((row) => !seenFaces.has(row.faceId))
        .map((row) => ({ ...row, slug: slugByPrinting.get(row.printingId) })),
    ];

    const otherCardIds = [
      ...new Set(printingRows.map((p) => p.cardId).filter((id) => id !== card.id)),
    ];
    const allCardIds = [card.id, ...otherCardIds];
    const setIds = [...new Set(printingRows.map((p) => p.setId))];
    const [otherCards, banRows, errataRows, sets] = await Promise.all([
      catalog.cardsByIds(otherCardIds),
      catalog.cardBansByCardIds(allCardIds),
      catalog.cardErrataByCardIds(allCardIds),
      catalog.setsByIds(setIds),
    ]);
    const builtCards = buildCardsResponse([card, ...otherCards], banRows, errataRows);
    const cards: Record<string, CatalogResponseCardValue> = {};
    for (const id of otherCardIds) {
      const built = builtCards[id];
      if (built) {
        const { id: _id, ...value } = built;
        cards[id] = value;
      }
    }

    return {
      // oxlint-disable-next-line typescript/no-non-null-assertion -- built from `card` one line up
      card: builtCards[card.id]!,
      cards,
      printings: presentPrintingValues(printingRows, imageRows, decorations),
      sets,
      markers: referencedMarkers(printingRows, decorations),
      distributionChannels: referencedChannels(printingIds, decorations),
      products,
    };
  }),

  related: os.related.handler(async ({ input, context, errors }): Promise<CardRelatedResponse> => {
    const { catalog } = context.repos;
    const card = await catalog.cardBySlug(input.cardSlug);
    if (!card) {
      throw errors.NOT_FOUND({ message: `Card not found: ${input.cardSlug}` });
    }
    return { related: await catalog.relatedCards(card.id, RELATED_CARDS_LIMIT) };
  }),
};
