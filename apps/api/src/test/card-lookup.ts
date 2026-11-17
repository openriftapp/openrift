import type { Repos } from "../deps.js";
import { createContentAddressedCache } from "../lib/content-addressed-cache.js";
import { assembleCardLookup } from "../modules/catalog/lib/card-lookup-index.js";

/** The `cardLookup` slot `createRepos` wires, built over a catalog double. */
export function cardLookupSlot(catalog: unknown): Repos["cardLookup"] {
  const repos = { catalog: catalog as Repos["catalog"] };
  return {
    current: createContentAddressedCache(
      () => assembleCardLookup(repos),
      () => repos.catalog.catalogContentVersion(),
    ),
  };
}
