import type { SourceSyncDeps, SourceSyncEnv } from "./deps.js";
import { createPacingGate } from "./paced-http.js";
import type { PlayloltcgClient } from "./playloltcg-client.js";
import { createPlayloltcgClient } from "./playloltcg-client.js";

export type PlayloltcgSyncDeps = SourceSyncDeps<PlayloltcgClient>;

export type PlayloltcgSyncEnv = SourceSyncEnv;

const gate = createPacingGate();

export function createPlayloltcgSyncDeps(env: PlayloltcgSyncEnv): PlayloltcgSyncDeps {
  return {
    repos: env.repos,
    transact: env.transact,
    log: env.log,
    client: createPlayloltcgClient({ fetch: env.fetch, baseUrl: env.baseUrl, gate }),
  };
}
