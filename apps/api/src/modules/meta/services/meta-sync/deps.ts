import type { Logger } from "@openrift/shared/logger";

import type { Repos, Transact } from "../../../../deps.js";
import type { Fetch } from "../../../../io.js";
import type { UvsClient } from "./uvsgames-client.js";

export interface SourceSyncDeps<TClient> {
  repos: Repos;
  transact: Transact;
  client: TClient;
  log: Logger;
  now?: () => Date;
}

export type MetaSyncDeps = SourceSyncDeps<UvsClient>;

export interface SourceSyncEnv {
  repos: Repos;
  transact: Transact;
  fetch: Fetch;
  log: Logger;
  baseUrl: string;
}

export function clock(deps: { now?: () => Date }): Date {
  return deps.now?.() ?? new Date();
}

export const EVENTS_PATH = "/api/v2/events/";
export const GAME_SLUG = "riftbound";
export const TEMPLATES_PATH = "/api/v2/event-configuration-templates/";
