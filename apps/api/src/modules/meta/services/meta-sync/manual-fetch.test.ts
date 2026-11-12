import { createLogger } from "@openrift/shared/logger";
import { describe, expect, it } from "vitest";

import type { Repos, Transact } from "../../../../deps.js";
import type { UvsgamesListRow } from "../../repositories/uvsgames-events.js";
import type { MetaSyncDeps } from "./deps.js";
import { fetchEventNow } from "./recheck.js";
import { SourceThrottledError } from "./source-http.js";
import type { UvsClient } from "./uvsgames-client.js";
import { fetchUvsgamesEvent } from "./uvsgames-on-demand.js";

const NOW = new Date("2026-09-16T12:00:00.000Z");
const ID = "667904";

const DETAIL = {
  id: 667_904,
  name: "Summoner Skirmish",
  game_type: "RIFTBOUND",
  start_datetime: "2026-09-12T09:00:00Z",
  display_status: "complete",
  event_format: "CONSTRUCTED",
};

function listRow(overrides: Partial<UvsgamesListRow> = {}): UvsgamesListRow {
  return {
    externalId: ID,
    name: "Summoner Skirmish",
    displayStatus: "complete",
    decklistStatus: null,
    nextCheckAt: NOW,
    checkStage: 0,
    resultsFetchedAt: null,
    ...overrides,
  } as UvsgamesListRow;
}

function throttledDeps(rows: UvsgamesListRow[]) {
  const rechecks: { externalId: string; values: unknown }[] = [];
  let reads = 0;
  const client: UvsClient = {
    get: <T>() => Promise.resolve(DETAIL as T),
    page: (path: string) => Promise.reject(new SourceThrottledError(path)),
    requests: 0,
  };
  const deps: MetaSyncDeps = {
    repos: {
      uvsgamesEvents: {
        byKey: () => Promise.resolve(rows[Math.min(reads++, rows.length - 1)]),
        upsertBatch: () => Promise.resolve({ inserted: [], changed: [ID], unchanged: [] }),
        setRecheck: (externalId: string, values: unknown) => {
          rechecks.push({ externalId, values });
          return Promise.resolve();
        },
      },
    } as unknown as Repos,
    transact: (() => Promise.reject(new Error("no writes here"))) as unknown as Transact,
    client,
    log: createLogger("test"),
    now: () => NOW,
  };
  return { deps, rechecks };
}

describe("a throttle during a manual fetch", () => {
  it("ends the on-demand fetch as failed and still settles the event's recheck", async () => {
    const settled = listRow({ resultsFetchedAt: NOW });
    const { deps, rechecks } = throttledDeps([listRow(), listRow(), settled]);

    const result = await fetchUvsgamesEvent(deps, ID);

    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.errors.join(" ")).toMatch(/Stopped by the source/u);
    expect(rechecks.map((write) => write.externalId)).toEqual([ID]);
  });

  it("records the throttle in the admin fetch job instead of failing the run", async () => {
    const { deps, rechecks } = throttledDeps([listRow({ resultsFetchedAt: NOW })]);

    const result = await fetchEventNow(deps, listRow());

    expect(result.stopped).toBe(true);
    expect(result.errors.join(" ")).toMatch(/Stopped by the source/u);
    expect(rechecks).toHaveLength(1);
  });
});
