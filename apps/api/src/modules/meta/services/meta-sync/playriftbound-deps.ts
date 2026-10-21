import type { Logger } from "@openrift/shared/logger";

import type { Repos, Transact } from "../../../../deps.js";
import type { Fetch } from "../../../../io.js";
import { createPacingGate } from "./paced-http.js";
import type { PlayriftboundClient } from "./playriftbound-client.js";
import { createManifestCache, createPlayriftboundClient } from "./playriftbound-client.js";

export interface PlayriftboundSyncDeps {
  repos: Repos;
  transact: Transact;
  client: PlayriftboundClient;
  log: Logger;
  now?: () => Date;
}

export interface PlayriftboundSyncEnv {
  repos: Repos;
  transact: Transact;
  fetch: Fetch;
  log: Logger;
  baseUrl: string;
}

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

export function clock(deps: PlayriftboundSyncDeps): Date {
  return deps.now?.() ?? new Date();
}
