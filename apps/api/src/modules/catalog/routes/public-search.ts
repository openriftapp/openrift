import { joinCatalogPrintings } from "@openrift/shared/catalog-join";
import type { SearchResponse } from "@openrift/shared/contracts/search";
import { searchContract } from "@openrift/shared/contracts/search";
import { priceLookupFromMap } from "@openrift/shared/price-lookup";
import { parseSearchQuery } from "@openrift/shared/search-query/parse";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import type { PriceMap } from "@openrift/shared/types/api/pricing";
import type { Printing } from "@openrift/shared/types/catalog";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { implement } from "@orpc/server";

import { requireUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import type { CatalogSearchSource, NamedCardIndex } from "../services/catalog-search.js";
import {
  buildNamedCardIndex,
  namedCard,
  queryReadsPrices,
  randomCard,
  runCatalogSearch,
} from "../services/catalog-search.js";

const os = implement(searchContract).$context<ApiContext>().use(requireUser);

let joined: { version: string; printings: Printing[]; names?: NamedCardIndex } | null = null;

function joinedCatalog(version: string, catalog: CatalogResponse) {
  if (joined?.version !== version) {
    joined = { version, printings: joinCatalogPrintings(catalog) };
  }
  return joined;
}

async function searchSource(context: ApiContext, q: string): Promise<CatalogSearchSource> {
  const { version, value: catalog } = await context.repos.catalogResponse.current();
  const [formats, priceRows] = await Promise.all([
    context.repos.cardBans.listFormats(),
    queryReadsPrices(parseSearchQuery(q))
      ? context.repos.marketplace.latestPrices()
      : Promise.resolve([]),
  ]);
  const priceMap: PriceMap = {};
  for (const row of priceRows) {
    priceMap[row.printingId] = {
      ...priceMap[row.printingId],
      [row.marketplace as Marketplace]: row.marketCents,
    };
  }
  return {
    catalog,
    printings: joinedCatalog(version, catalog).printings,
    formats,
    prices: priceLookupFromMap(priceMap),
  };
}

export const searchRouter = {
  search: os.search.handler(async ({ context, input, errors }): Promise<SearchResponse> => {
    const result = runCatalogSearch(await searchSource(context, input.q), input);
    if (!result.ok) {
      throw errors.BAD_REQUEST({ data: { diagnostics: result.diagnostics } });
    }
    return result.response;
  }),

  named: os.named.handler(async ({ context, input, errors }): Promise<SearchResponse> => {
    const { version, value: catalog } = await context.repos.catalogResponse.current();
    const entry = joinedCatalog(version, catalog);
    entry.names ??= buildNamedCardIndex(catalog, entry.printings);
    const response = namedCard(
      { catalog, printings: entry.printings, formats: [] },
      entry.names,
      input,
    );
    if (!response) {
      throw errors.NOT_FOUND();
    }
    return response;
  }),

  random: os.random.handler(async ({ context, input, errors }): Promise<SearchResponse> => {
    const result = randomCard(await searchSource(context, input.q ?? ""), input.q);
    if (!result) {
      throw errors.NOT_FOUND();
    }
    if (!result.ok) {
      throw errors.BAD_REQUEST({ data: { diagnostics: result.diagnostics } });
    }
    return result.response;
  }),
};
