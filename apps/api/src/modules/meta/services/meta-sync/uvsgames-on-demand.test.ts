import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../../deps.js";
import { projectCatalogRow } from "../../lib/uvsgames-catalog.js";
import { deepFetchEvent } from "./deep-fetch.js";
import type { MetaSyncDeps } from "./deps.js";
import { UvsHttpError } from "./uvsgames-client.js";
import { ON_DEMAND_FETCH_COOLDOWN_MS, fetchUvsgamesEvent } from "./uvsgames-on-demand.js";

vi.mock("./deep-fetch.js", () => ({ deepFetchEvent: vi.fn() }));
vi.mock("../../lib/uvsgames-catalog.js", () => ({ projectCatalogRow: vi.fn() }));

const NOW = new Date("2026-09-16T12:00:00.000Z");
const ID = "667904";
const ROW = { externalId: ID, name: "Summoner Skirmish", resultsFetchedAt: null };
const DETAIL = { id: 667_904, game_type: "RIFTBOUND" };

const byKey = vi.fn();
const upsertBatch = vi.fn();
const get = vi.fn();

function deps(): MetaSyncDeps {
  return {
    repos: { uvsgamesEvents: { byKey, upsertBatch } } as unknown as Repos,
    transact: vi.fn(),
    client: { get, requests: 0 } as unknown as MetaSyncDeps["client"],
    log: { info: vi.fn(), warn: vi.fn() } as unknown as MetaSyncDeps["log"],
    now: () => NOW,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  byKey.mockResolvedValue(ROW);
  get.mockResolvedValue(DETAIL);
  vi.mocked(projectCatalogRow).mockReturnValue({ externalId: ID } as never);
  vi.mocked(deepFetchEvent).mockResolvedValue({ errors: [] } as never);
});

describe("fetchUvsgamesEvent", () => {
  it("mirrors the row and its results", async () => {
    const result = await fetchUvsgamesEvent(deps(), ID);

    expect(result).toEqual({ status: "fetched", row: ROW, errors: [] });
    expect(get).toHaveBeenCalledWith(`/api/v2/events/${ID}/`);
    expect(upsertBatch).toHaveBeenCalledWith([{ externalId: ID }], NOW);
    expect(deepFetchEvent).toHaveBeenCalledWith(expect.anything(), ROW, undefined, DETAIL);
  });

  it("reads the mirror inside the cooldown", async () => {
    const fetchedAt = new Date(NOW.getTime() - ON_DEMAND_FETCH_COOLDOWN_MS + 1000);
    byKey.mockResolvedValue({ ...ROW, resultsFetchedAt: fetchedAt });

    const result = await fetchUvsgamesEvent(deps(), ID);

    expect(result.status).toBe("fresh");
    expect(get).not.toHaveBeenCalled();
  });

  it("fetches again once the cooldown has passed", async () => {
    const fetchedAt = new Date(NOW.getTime() - ON_DEMAND_FETCH_COOLDOWN_MS - 1000);
    byKey.mockResolvedValue({ ...ROW, resultsFetchedAt: fetchedAt });

    const result = await fetchUvsgamesEvent(deps(), ID);

    expect(result.status).toBe("fetched");
  });

  it("reports an id the source does not know", async () => {
    byKey.mockResolvedValue(undefined);
    get.mockRejectedValue(new UvsHttpError(404, `/api/v2/events/${ID}/`, "Not found"));

    expect(await fetchUvsgamesEvent(deps(), ID)).toEqual({ status: "not_found" });
    expect(upsertBatch).not.toHaveBeenCalled();
  });

  it("treats another game's event as unknown", async () => {
    get.mockResolvedValue({ id: 1, game_type: "LORCANA" });

    expect(await fetchUvsgamesEvent(deps(), ID)).toEqual({ status: "not_found" });
  });

  it("reports a failed read without writing", async () => {
    get.mockRejectedValue(new Error("socket hang up"));

    const result = await fetchUvsgamesEvent(deps(), ID);

    expect(result).toEqual({ status: "failed", errors: ["Event detail: socket hang up"] });
    expect(upsertBatch).not.toHaveBeenCalled();
  });
});
