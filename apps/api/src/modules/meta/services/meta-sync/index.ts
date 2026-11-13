import type { MetaSyncDeps, SourceSyncEnv } from "./deps.js";
import { createPacingGate } from "./paced-http.js";
import { createUvsClient } from "./uvsgames-client.js";

export type { MetaSyncDeps } from "./deps.js";
export { acceptCatalogEvent, autoAcceptCatalogBacklog } from "./accept.js";
export type { MetaAutoAcceptSummary } from "./accept.js";
export { backfillCatalog, syncCatalog, isCatalogSyncNoop } from "./catalog-sync.js";
export type { MetaCatalogSyncResult } from "./catalog-sync.js";
export { deepFetchEvent } from "./deep-fetch.js";
export { isIdSweepNoop, MAX_PROBES_PER_SWEEP, sweepEventIds } from "./id-sweep.js";
export type { IdSweepOptions, MetaIdSweepResult } from "./id-sweep.js";
export type { MetaDeepFetchResult } from "./deep-fetch.js";
export { fetchEventNow, isRecheckNoop, processRechecks } from "./recheck.js";
export type { MetaRecheckResult } from "./recheck.js";
export { createPlayloltcgSyncDeps } from "./playloltcg-deps.js";
export type { PlayloltcgSyncDeps } from "./playloltcg-deps.js";
export { acceptPlayloltcgEvent, autoAcceptPlayloltcgBacklog } from "./playloltcg-accept.js";
export type { PlayloltcgAcceptSummary } from "./playloltcg-accept.js";
export {
  backfillPlayloltcg,
  fetchPlayloltcgEvent,
  isPlayloltcgRecheckNoop,
  isPlayloltcgSyncNoop,
  processPlayloltcgRechecks,
  syncPlayloltcgCatalog,
} from "./playloltcg-sync.js";
export type {
  PlayloltcgBackfillOptions,
  PlayloltcgRecheckResult,
  PlayloltcgSyncResult,
} from "./playloltcg-sync.js";
export { metaJobSkipReason } from "./source-stop.js";
export { createTopdeckSyncDeps } from "./topdeck-deps.js";
export type { TopdeckSyncDeps } from "./topdeck-deps.js";
export { acceptTopdeckEvent, autoAcceptTopdeckBacklog } from "./topdeck-accept.js";
export type { TopdeckAcceptSummary } from "./topdeck-accept.js";
export { backfillTopdeck, isTopdeckSyncNoop, syncTopdeckCatalog } from "./topdeck-sync.js";
export type { TopdeckBackfillOptions, TopdeckSyncResult } from "./topdeck-sync.js";
export { createPlayriftboundSyncDeps } from "./playriftbound-deps.js";
export type { PlayriftboundSyncDeps } from "./playriftbound-deps.js";
export {
  acceptPlayriftboundEvent,
  autoAcceptPlayriftboundBacklog,
} from "./playriftbound-accept.js";
export type { PlayriftboundAcceptSummary } from "./playriftbound-accept.js";
export {
  backfillPlayriftbound,
  fetchPlayriftboundEvent,
  isPlayriftboundRecheckNoop,
  isPlayriftboundSyncNoop,
  processPlayriftboundRechecks,
  syncPlayriftboundCatalog,
} from "./playriftbound-sync.js";
export type {
  PlayriftboundBackfillOptions,
  PlayriftboundRecheckResult,
  PlayriftboundSyncResult,
} from "./playriftbound-sync.js";

export interface MetaSyncEnv extends SourceSyncEnv {
  interactive?: boolean;
}

const gate = createPacingGate();

/** Create one client per run: a shared client's request counter would mix budgets across runs. */
export function createMetaSyncDeps(env: MetaSyncEnv): MetaSyncDeps {
  return {
    repos: env.repos,
    transact: env.transact,
    log: env.log,
    client: createUvsClient({
      fetch: env.fetch,
      baseUrl: env.baseUrl,
      gate,
      waitOnThrottle: env.interactive !== true,
    }),
  };
}
