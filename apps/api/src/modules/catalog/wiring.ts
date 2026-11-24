import type { KeepPriorityOrders } from "@openrift/shared/list-rule-eval";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import type { Kysely } from "kysely";

import type { Database } from "../../db/tables.js";
import type { Repos } from "../../deps.js";
import type { Versioned, VersionProbe } from "../../lib/content-addressed-cache.js";
import {
  createContentAddressedCache,
  createVersionedCache,
} from "../../lib/content-addressed-cache.js";
import type { CardLookup } from "./lib/card-lookup-index.js";
import { assembleCardLookup } from "./lib/card-lookup-index.js";
import { artVariantsRepo } from "./repositories/art-variants.js";
import { canonicalPrintingsRepo } from "./repositories/canonical-printings.js";
import { cardBansRepo } from "./repositories/card-bans.js";
import { cardErrataRepo } from "./repositories/card-errata.js";
import { cardTokensRepo } from "./repositories/card-tokens.js";
import { cardTypesRepo } from "./repositories/card-types.js";
import { catalogDeleteGuardsRepo } from "./repositories/catalog-delete-guards.js";
import { catalogMutationsRepo } from "./repositories/catalog-mutations.js";
import { catalogVersionsRepo } from "./repositories/catalog-versions.js";
import { catalogRepo } from "./repositories/catalog.js";
import { distributionChannelsRepo } from "./repositories/distribution-channels.js";
import { domainsRepo } from "./repositories/domains.js";
import type { AllEnumRows } from "./repositories/enums.js";
import { enumsRepo } from "./repositories/enums.js";
import { finishesRepo } from "./repositories/finishes.js";
import { keywordsRepo } from "./repositories/keywords.js";
import { languagesRepo } from "./repositories/languages.js";
import { markersRepo } from "./repositories/markers.js";
import { printingCitationsRepo } from "./repositories/printing-citations.js";
import { printingDeskRepo } from "./repositories/printing-desk.js";
import { printingEventsRepo } from "./repositories/printing-events.js";
import { printingImagesRepo } from "./repositories/printing-images.js";
import { raritiesRepo } from "./repositories/rarities.js";
import { rulesRepo } from "./repositories/rules.js";
import { setsRepo } from "./repositories/sets.js";
import { superTypesRepo } from "./repositories/super-types.js";
import { tagCategoryRepo } from "./repositories/tag-categories.js";
import { tagDefinitionsRepo } from "./repositories/tag-definitions.js";
import { tagTranslationsRepo } from "./repositories/tag-translations.js";
import { assembleCatalogResponse, assembleRuleCatalog } from "./services/catalog-assembly.js";
import type { RuleCatalog } from "./services/catalog-assembly.js";

export interface CatalogRepos {
  artVariants: ReturnType<typeof artVariantsRepo>;
  cardBans: ReturnType<typeof cardBansRepo>;
  cardErrata: ReturnType<typeof cardErrataRepo>;
  cardTokens: ReturnType<typeof cardTokensRepo>;
  cardTypes: ReturnType<typeof cardTypesRepo>;
  canonicalPrintings: ReturnType<typeof canonicalPrintingsRepo>;
  catalog: ReturnType<typeof catalogRepo>;
  catalogResponse: { current: () => Promise<Versioned<CatalogResponse>> };
  cardLookup: { current: () => Promise<CardLookup> };
  catalogDeleteGuards: ReturnType<typeof catalogDeleteGuardsRepo>;
  catalogMutations: ReturnType<typeof catalogMutationsRepo>;
  domains: ReturnType<typeof domainsRepo>;
  enums: ReturnType<typeof enumsRepo>;
  finishes: ReturnType<typeof finishesRepo>;
  keywords: ReturnType<typeof keywordsRepo>;
  languages: ReturnType<typeof languagesRepo>;
  printingImages: ReturnType<typeof printingImagesRepo>;
  printingCitations: ReturnType<typeof printingCitationsRepo>;
  printingDesk: ReturnType<typeof printingDeskRepo>;
  markers: ReturnType<typeof markersRepo>;
  distributionChannels: ReturnType<typeof distributionChannelsRepo>;
  rarities: ReturnType<typeof raritiesRepo>;
  rules: ReturnType<typeof rulesRepo>;
  sets: ReturnType<typeof setsRepo>;
  superTypes: ReturnType<typeof superTypesRepo>;
  tagCategories: ReturnType<typeof tagCategoryRepo>;
  tagDefinitions: ReturnType<typeof tagDefinitionsRepo>;
  tagTranslations: ReturnType<typeof tagTranslationsRepo>;
  printingEvents: ReturnType<typeof printingEventsRepo>;
}

export interface CatalogRuleSources {
  enums: ReturnType<typeof enumsRepo>;
  assembleCatalog: () => Promise<RuleCatalog>;
  catalogResponse: () => Promise<Versioned<CatalogResponse>>;
  cardLookup: () => Promise<CardLookup>;
  enumOrders: () => Promise<KeepPriorityOrders>;
}

export interface CatalogCaches {
  db: Kysely<Database>;
  enums: (probe?: VersionProbe) => Promise<AllEnumRows>;
  ruleCatalog: (probe?: VersionProbe) => Promise<RuleCatalog>;
  catalogResponse: (probe?: VersionProbe) => Promise<Versioned<CatalogResponse>>;
  cardLookup: (probe?: VersionProbe) => Promise<CardLookup>;
}

/**
 * One per pool, shared by its transactions. Loads read committed rows through the pool, so a
 * transaction's own uncommitted catalog writes never reach the cache, and it never reads them back.
 */
export function createCatalogCaches(db: Kysely<Database>, poolRepos: () => Repos): CatalogCaches {
  const enums = enumsRepo(db);
  const versions = catalogVersionsRepo(db);
  return {
    db,
    enums: createContentAddressedCache(
      () => enums.all(),
      () => enums.contentVersion(),
    ),
    ruleCatalog: createContentAddressedCache(
      () => assembleRuleCatalog(poolRepos()),
      () => versions.catalogContentVersion(),
    ),
    catalogResponse: createVersionedCache(
      () => assembleCatalogResponse(poolRepos()),
      () => versions.catalogResponseVersion(),
    ),
    cardLookup: createContentAddressedCache(
      () => assembleCardLookup(poolRepos()),
      () => versions.catalogContentVersion(),
    ),
  };
}

/** A transaction probes the version on its own connection, so a cache hit takes no second connection from the pool. */
export function createCatalogRuleSources(
  db: Kysely<Database>,
  caches: CatalogCaches,
): CatalogRuleSources {
  const enums = enumsRepo(db);
  const versions = catalogVersionsRepo(db);
  const onPool = db === caches.db;
  const ownProbe = (version: VersionProbe) => (onPool ? undefined : version);
  const contentVersion = ownProbe(() => versions.catalogContentVersion());

  const loadEnums = () => caches.enums(ownProbe(() => enums.contentVersion()));
  const keepPriorityOrders = async (): Promise<KeepPriorityOrders> => {
    const rows = await loadEnums();
    return {
      finishes: rows.finishes.map((row) => row.slug),
      rarities: rows.rarities.map((row) => row.slug),
      artVariants: rows.artVariants.map((row) => row.slug),
    };
  };

  return {
    enums: { ...enums, all: loadEnums, keepPriorityOrders },
    assembleCatalog: () => caches.ruleCatalog(contentVersion),
    catalogResponse: () =>
      caches.catalogResponse(ownProbe(() => versions.catalogResponseVersion())),
    cardLookup: () => caches.cardLookup(contentVersion),
    enumOrders: keepPriorityOrders,
  };
}

export function createCatalogRepos(
  db: Kysely<Database>,
  sources: CatalogRuleSources,
): CatalogRepos {
  return {
    artVariants: artVariantsRepo(db),
    cardBans: cardBansRepo(db),
    cardErrata: cardErrataRepo(db),
    cardTokens: cardTokensRepo(db),
    cardTypes: cardTypesRepo(db),
    canonicalPrintings: canonicalPrintingsRepo(db),
    catalog: catalogRepo(db),
    catalogResponse: { current: sources.catalogResponse },
    cardLookup: { current: sources.cardLookup },
    catalogDeleteGuards: catalogDeleteGuardsRepo(db),
    catalogMutations: catalogMutationsRepo(db),
    domains: domainsRepo(db),
    enums: sources.enums,
    finishes: finishesRepo(db),
    keywords: keywordsRepo(db),
    languages: languagesRepo(db),
    printingImages: printingImagesRepo(db),
    printingCitations: printingCitationsRepo(db),
    printingDesk: printingDeskRepo(db),
    markers: markersRepo(db),
    distributionChannels: distributionChannelsRepo(db),
    rarities: raritiesRepo(db),
    rules: rulesRepo(db),
    sets: setsRepo(db),
    superTypes: superTypesRepo(db),
    tagCategories: tagCategoryRepo(db, { table: "tagCategories", tagTable: "tagDefinitions" }),
    tagDefinitions: tagDefinitionsRepo(db),
    tagTranslations: tagTranslationsRepo(db),
    printingEvents: printingEventsRepo(db),
  };
}
