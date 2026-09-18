import { projectCatalogRow } from "../../lib/uvsgames-catalog.js";
import type { UvsgamesListRow } from "../../repositories/uvsgames-events.js";
import { deepFetchEvent } from "./deep-fetch.js";
import type { MetaSyncDeps } from "./deps.js";
import { clock, errorText } from "./deps.js";
import { gameTypeOf } from "./id-sweep.js";
import { UvsHttpError } from "./uvsgames-client.js";

export const ON_DEMAND_FETCH_COOLDOWN_MS = 10 * 60 * 1000;

export type UvsgamesOnDemandResult =
  | { status: "fetched" | "fresh"; row: UvsgamesListRow; errors: string[] }
  | { status: "not_found" }
  | { status: "failed"; errors: string[] };

/**
 * Mirrors one event by id, catalogue row and results, the way the id sweep and
 * the deep fetch would. It accepts nothing into the archive.
 */
export async function fetchUvsgamesEvent(
  deps: MetaSyncDeps,
  externalId: string,
): Promise<UvsgamesOnDemandResult> {
  const known = await deps.repos.uvsgamesEvents.byKey(externalId);
  if (
    known?.resultsFetchedAt !== null &&
    known?.resultsFetchedAt !== undefined &&
    clock(deps).getTime() - known.resultsFetchedAt.getTime() < ON_DEMAND_FETCH_COOLDOWN_MS
  ) {
    return { status: "fresh", row: known, errors: [] };
  }

  let detail: unknown;
  try {
    detail = await deps.client.get<unknown>(`/api/v2/events/${externalId}/`);
  } catch (error) {
    if (error instanceof UvsHttpError && error.status === 404) {
      return { status: "not_found" };
    }
    return { status: "failed", errors: [errorText(error, "Event detail")] };
  }
  if (!gameTypeOf(detail).isRiftbound) {
    return { status: "not_found" };
  }
  const projection = projectCatalogRow(detail);
  if (projection === null) {
    return { status: "failed", errors: ["The source's event detail could not be read."] };
  }

  await deps.repos.uvsgamesEvents.upsertBatch([projection], clock(deps));
  const row = await deps.repos.uvsgamesEvents.byKey(externalId);
  if (row === undefined) {
    return { status: "failed", errors: ["The event could not be mirrored."] };
  }
  const fetched = await deepFetchEvent(deps, row, undefined, detail);
  const settled = (await deps.repos.uvsgamesEvents.byKey(externalId)) ?? row;
  return { status: "fetched", row: settled, errors: fetched.errors };
}
