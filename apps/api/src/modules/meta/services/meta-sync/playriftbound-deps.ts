import type { SourceSyncDeps, SourceSyncEnv } from "./deps.js";
import { createPacingGate } from "./paced-http.js";
import type { PlayriftboundClient } from "./playriftbound-client.js";
import { createManifestCache, createPlayriftboundClient } from "./playriftbound-client.js";

export type PlayriftboundSyncDeps = SourceSyncDeps<PlayriftboundClient>;

export type PlayriftboundSyncEnv = SourceSyncEnv;

const manifestCache = createManifestCache();
const gate = createPacingGate();

/** Create one client per run: a shared client's request counter would mix budgets across runs. */
export function createPlayriftboundSyncDeps(env: PlayriftboundSyncEnv): PlayriftboundSyncDeps {
  return {
    repos: env.repos,
    transact: env.transact,
    log: env.log,
    client: createPlayriftboundClient({
      fetch: env.fetch,
      baseUrl: env.baseUrl,
      cache: manifestCache,
      gate,
    }),
  };
}
