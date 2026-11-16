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

export interface CardLookup {
  names: CardLookupIndex;
  codes: CardCodeIndex;
}

type CardLookupRepos = Pick<Repos, "catalog"> & Partial<Pick<Repos, "cardLookup">>;

export async function assembleCardLookup(repos: Pick<Repos, "catalog">): Promise<CardLookup> {
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

const handBuiltLoaders = new WeakMap<object, () => Promise<CardLookup>>();

/** Repos from `createRepos` share one lookup per pool; a hand-built `repos` without it keeps its own memo. */
function loadCardLookup(repos: CardLookupRepos): Promise<CardLookup> {
  if (repos.cardLookup) {
    return repos.cardLookup.current();
  }
  let load = handBuiltLoaders.get(repos);
  if (!load) {
    load = createContentAddressedCache(
      () => assembleCardLookup(repos),
      () => repos.catalog.catalogContentVersion(),
    );
    handBuiltLoaders.set(repos, load);
  }
  return load();
}

export function createCardLookupIndexLoader(
  repos: CardLookupRepos,
): () => Promise<CardLookupIndex> {
  return async () => {
    const lookup = await loadCardLookup(repos);
    return lookup.names;
  };
}

export function createCardCodeIndexLoader(repos: CardLookupRepos): () => Promise<CardCodeIndex> {
  return async () => {
    const lookup = await loadCardLookup(repos);
    return lookup.codes;
  };
}
