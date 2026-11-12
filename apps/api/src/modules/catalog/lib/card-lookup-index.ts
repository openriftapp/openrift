import type { LookupRow } from "@openrift/shared/card-lookup";
import { buildCardLookupIndex } from "@openrift/shared/card-lookup";
import type {
  CardSearchIndex,
  CodeIndex,
  SearchablePrintingCodes,
} from "@openrift/shared/card-search";
import { buildCodeIndex } from "@openrift/shared/card-search";

import type { Repos } from "../../../deps.js";
import { createContentAddressedCache } from "../../../lib/content-addressed-cache.js";
import type { CatalogCardRow } from "../repositories/catalog-cards.js";

export type CardLookupIndex = CardSearchIndex<LookupRow<CatalogCardRow>>;

export type CardCodeIndex = CodeIndex<CatalogCardRow, SearchablePrintingCodes>;

interface CardLookup {
  names: CardLookupIndex;
  codes: CardCodeIndex;
}

async function assembleCardLookup(repos: Repos): Promise<CardLookup> {
  const [cards, printings] = await Promise.all([
    repos.catalog.cards(),
    repos.catalog.printingLookupRows(),
  ]);
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  return {
    names: buildCardLookupIndex(cards, printings),
    codes: buildCodeIndex(
      printings.flatMap((printing) => {
        const card = cardsById.get(printing.cardId);
        return card ? [{ card, printing }] : [];
      }),
    ),
  };
}

function createCardLookupLoader(repos: Repos): () => Promise<CardLookup> {
  return createContentAddressedCache(
    () => assembleCardLookup(repos),
    () => repos.catalog.catalogContentVersion(),
  );
}

const loaders = new WeakMap<Repos, () => Promise<CardLookup>>();

/** Cache key is a content-version probe, not a clock: an edit invalidates it immediately. */
function cardLookupFor(repos: Repos): () => Promise<CardLookup> {
  let loader = loaders.get(repos);
  if (!loader) {
    loader = createCardLookupLoader(repos);
    loaders.set(repos, loader);
  }
  return loader;
}

export function createCardLookupIndexLoader(repos: Repos): () => Promise<CardLookupIndex> {
  const load = cardLookupFor(repos);
  return async () => {
    const lookup = await load();
    return lookup.names;
  };
}

export function createCardCodeIndexLoader(repos: Repos): () => Promise<CardCodeIndex> {
  const load = cardLookupFor(repos);
  return async () => {
    const lookup = await load();
    return lookup.codes;
  };
}
