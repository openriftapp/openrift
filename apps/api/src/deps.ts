import type { Kysely } from "kysely";

import { instrumentRepo } from "./db/instrumented-repo.js";
import type { Database } from "./db/tables.js";
import type { EmailDeps } from "./email.js";
import { createCandidatesRepos, createCandidatesServices } from "./modules/candidates/wiring.js";
import type { CandidatesRepos, CandidatesServices } from "./modules/candidates/wiring.js";
import {
  createCatalogCaches,
  createCatalogRepos,
  createCatalogRuleSources,
} from "./modules/catalog/wiring.js";
import type { CatalogCaches, CatalogRepos } from "./modules/catalog/wiring.js";
import { createCollectionsRepos, createOwnedCopiesReader } from "./modules/collections/wiring.js";
import type { CollectionsRepos } from "./modules/collections/wiring.js";
import { createDecksRepos } from "./modules/decks/wiring.js";
import type { DecksRepos } from "./modules/decks/wiring.js";
import { createGroupsRepos, createGroupsServices } from "./modules/groups/wiring.js";
import type { GroupsRepos, GroupsServices } from "./modules/groups/wiring.js";
import { createListsRepos } from "./modules/lists/wiring.js";
import type { ListsRepos } from "./modules/lists/wiring.js";
import { createMarketplaceRepos, createRulePriceLookup } from "./modules/marketplace/wiring.js";
import type { MarketplaceRepos } from "./modules/marketplace/wiring.js";
import { createMetaRepos, createMetaServices } from "./modules/meta/wiring.js";
import type { MetaRepos, MetaServices } from "./modules/meta/wiring.js";
import { createScanRepos, createScanServices } from "./modules/scan/wiring.js";
import type { ScanRepos, ScanServices } from "./modules/scan/wiring.js";
import { createStageRepos } from "./modules/stage/wiring.js";
import type { StageRepos } from "./modules/stage/wiring.js";
import { createSystemRepos } from "./modules/system/wiring.js";
import type { SystemRepos } from "./modules/system/wiring.js";
import { createTournamentsRepos } from "./modules/tournaments/wiring.js";
import type { TournamentsRepos } from "./modules/tournaments/wiring.js";
import { createUsersRepos } from "./modules/users/wiring.js";
import type { UsersRepos } from "./modules/users/wiring.js";

export type Repos = CandidatesRepos &
  CatalogRepos &
  CollectionsRepos &
  DecksRepos &
  GroupsRepos &
  ListsRepos &
  MarketplaceRepos &
  MetaRepos &
  ScanRepos &
  StageRepos &
  SystemRepos &
  TournamentsRepos &
  UsersRepos;

export type Services = CandidatesServices & GroupsServices & MetaServices & ScanServices;

type Intersection<Modules extends readonly object[]> = Modules extends readonly [
  infer Head,
  ...infer Rest extends readonly object[],
]
  ? Head & Intersection<Rest>
  : unknown;

function instrumentModules<const Modules extends readonly object[]>(
  modules: Modules,
): Intersection<Modules> {
  const slots: Record<string, unknown> = {};
  for (const module of modules) {
    for (const [name, repo] of Object.entries(module)) {
      if (name in slots) {
        throw new Error(`Two modules declare the repository slot "${name}".`);
      }
      slots[name] = instrumentRepo(name, repo as Record<string, unknown>);
    }
  }
  return slots as Intersection<Modules>;
}

const catalogCachesByPool = new WeakMap<Kysely<Database>, CatalogCaches>();

function catalogCachesFor(db: Kysely<Database>): CatalogCaches {
  let caches = catalogCachesByPool.get(db);
  if (!caches) {
    let poolRepos: Repos | undefined;
    caches = createCatalogCaches(db, () => (poolRepos ??= createRepos(db)));
    catalogCachesByPool.set(db, caches);
  }
  return caches;
}

function buildRepos(db: Kysely<Database>, caches: CatalogCaches): Repos {
  const catalogSources = createCatalogRuleSources(db, caches);
  const ruleProviders = {
    assembleCatalog: catalogSources.assembleCatalog,
    ownedCopies: createOwnedCopiesReader(db),
    enumOrders: catalogSources.enumOrders,
    priceLookup: createRulePriceLookup(db),
  };

  const repos: Repos = instrumentModules([
    createCandidatesRepos(db),
    createCatalogRepos(db, catalogSources),
    createCollectionsRepos(db),
    createDecksRepos(db),
    createGroupsRepos(db, ruleProviders),
    createListsRepos(db, ruleProviders),
    createMarketplaceRepos(db),
    createMetaRepos(db, (trx) => (trx === db ? repos : buildRepos(trx, caches))),
    createScanRepos(db),
    createStageRepos(db),
    createSystemRepos(db),
    createTournamentsRepos(db),
    createUsersRepos(db),
  ]);
  return repos;
}

/** Catalog caches are built once per pool and shared with every transaction `createTransact` opens on it. */
export function createRepos(db: Kysely<Database>): Repos {
  return buildRepos(db, catalogCachesFor(db));
}

export type Transact = <T>(fn: (repos: Repos) => Promise<T>) => Promise<T>;

export function createTransact(db: Kysely<Database>): Transact {
  const caches = catalogCachesFor(db);
  return <T>(fn: (repos: Repos) => Promise<T>) =>
    db.transaction().execute((trx) => fn(buildRepos(trx, caches)));
}

export function createServices(emailDeps?: EmailDeps): Services {
  return {
    ...createCandidatesServices(emailDeps),
    ...createGroupsServices(emailDeps),
    ...createMetaServices(emailDeps),
    ...createScanServices(),
  };
}

export const services: Services = createServices();
