import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import type * as metaPromoteShared from "./meta-promote-shared.js";
import { promoteStandings } from "./meta-promote-standings.js";
import { promoteMetaEvent, promoteNewEvent } from "./meta-promote.js";

vi.mock("../../candidates/services/candidate-links.js", () => ({
  loadCardNameIndex: vi.fn(() => Promise.resolve({})),
}));
vi.mock("./meta-promote-shared.js", async (importOriginal) => ({
  ...(await importOriginal<typeof metaPromoteShared>()),
  createMetaSourceContext: vi.fn(() => Promise.resolve({})),
}));
vi.mock("./meta-promote-standings.js", () => ({ promoteStandings: vi.fn() }));
vi.mock("./meta-promote-overlays.js", () => ({
  applyPlayerOverlays: vi.fn(),
  dropOrphanMintedPlayers: vi.fn(),
}));
vi.mock("./meta-promote-matches.js", () => ({ promotePhasesAndMatches: vi.fn() }));

const EVENT_ID = "e0000000-0001-4000-a000-000000000001";

const LIVE = {
  id: EVENT_ID,
  name: "Summoner Skirmish",
  eventDate: "2026-08-15",
  format: "constructed",
  playerCount: null,
  organizer: null,
  notes: null,
  tier: "local",
  country: null,
  location: null,
};

const lockedMeta = {
  withPromoteLock: vi.fn(),
  eventRowById: vi.fn(),
  eventById: vi.fn(),
  eventBySlug: vi.fn(),
  sourcesForEvent: vi.fn(),
  sourceByKey: vi.fn(),
  createEventIfSlugFree: vi.fn(),
  insertEventSource: vi.fn(),
  updateEvent: vi.fn(),
};

const locked = {
  meta: lockedMeta,
  metaOverlays: { acceptedEventOverlays: vi.fn(() => Promise.resolve([])) },
  ingest: {},
} as unknown as Repos;

const poolLock = vi.fn((_key: string, run: (repos: Repos) => Promise<unknown>) => run(locked));

const pool = { meta: { withPromoteLock: poolLock } } as unknown as Repos;

beforeEach(() => {
  vi.clearAllMocks();
  lockedMeta.withPromoteLock.mockImplementation(
    (_key: string, run: (repos: Repos) => Promise<unknown>) => run(locked),
  );
  lockedMeta.eventRowById.mockResolvedValue(LIVE);
  lockedMeta.eventById.mockResolvedValue({ ...LIVE, slug: "summoner-skirmish" });
  lockedMeta.eventBySlug.mockResolvedValue(undefined);
  lockedMeta.sourcesForEvent.mockResolvedValue([]);
  lockedMeta.sourceByKey.mockResolvedValue(undefined);
});

describe("promoteMetaEvent", () => {
  it("runs every promotion step on the repos its lock hands it", async () => {
    await promoteMetaEvent(pool, EVENT_ID);

    expect(poolLock).toHaveBeenCalledWith(`event:${EVENT_ID}`, expect.any(Function));
    expect(lockedMeta.eventRowById).toHaveBeenCalledWith(EVENT_ID);
    expect(vi.mocked(promoteStandings).mock.calls[0]![0]).toBe(locked);
  });
});

describe("promoteNewEvent", () => {
  const SEED = {
    name: "Summoner Skirmish",
    eventDate: "2026-08-15",
    format: "constructed",
    sourceUrl: null,
  };

  it("mints under the source lock and tries a fresh slug when one was taken meanwhile", async () => {
    lockedMeta.createEventIfSlugFree
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: EVENT_ID });

    const result = await promoteNewEvent(pool, "uvsgames", "evt-1", SEED);

    expect(poolLock).toHaveBeenCalledWith("source:uvsgames:evt-1", expect.any(Function));
    expect(lockedMeta.createEventIfSlugFree).toHaveBeenCalledTimes(2);
    expect(lockedMeta.insertEventSource).toHaveBeenCalledWith(
      expect.objectContaining({ metaEventId: EVENT_ID, provider: "uvsgames", externalId: "evt-1" }),
    );
    expect(result).toMatchObject({ metaEventId: EVENT_ID, created: true });
  });

  it("answers a conflict when every fresh slug is taken", async () => {
    lockedMeta.createEventIfSlugFree.mockResolvedValue(undefined);

    await expect(promoteNewEvent(pool, "uvsgames", "evt-1", SEED)).rejects.toMatchObject({
      status: 409,
    });
    expect(lockedMeta.createEventIfSlugFree).toHaveBeenCalledTimes(3);
    expect(lockedMeta.insertEventSource).not.toHaveBeenCalled();
  });
});
