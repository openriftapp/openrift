import type { SourceSyncDeps, SourceSyncEnv } from "./deps.js";
import { createPacingGate } from "./paced-http.js";
import type { TopdeckClient } from "./topdeck-client.js";
import { createTopdeckClient } from "./topdeck-client.js";

export type TopdeckSyncDeps = SourceSyncDeps<TopdeckClient>;

export interface TopdeckSyncEnv extends SourceSyncEnv {
  apiKey: string;
}

const gate = createPacingGate();

export function createTopdeckSyncDeps(env: TopdeckSyncEnv): TopdeckSyncDeps {
  return {
    repos: env.repos,
    transact: env.transact,
    log: env.log,
    client: createTopdeckClient({
      fetch: env.fetch,
      baseUrl: env.baseUrl,
      apiKey: env.apiKey,
      gate,
    }),
  };
}
