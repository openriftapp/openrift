import { describe, expect, it, vi } from "vitest";

import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import { TOURNAMENT_LIST_PROVIDER } from "../../../lib/meta-providers.js";
import { playerSourceKey } from "./ingest-meta-overlays.js";
import { loadTournamentListTarget, sendTournamentLists } from "./meta-tournament-lists.js";
import type { SendTournamentListsArgs } from "./meta-tournament-lists.js";

const UVS_ID = "667904";
const META_EVENT_ID = "3f7a1c2e-0000-7000-8000-000000000001";

const EVENT = {
  externalId: UVS_ID,
  name: "Summoner Skirmish",
  startAt: new Date("2026-09-12T16:00:00.000Z"),
  timezone: "Europe/Berlin",
  displayStatus: "complete",
  eventFormat: "Constructed",
  playerCount: 16,
  storeName: "Piltover Games",
  resultsFetchedAt: new Date("2026-09-13T08:00:00.000Z"),
};

const STANDINGS = [
  {
    registrationId: "900",
    uvsgamesPlayerId: 11,
    playerName: "Nova",
    rank: 1,
    wins: 4,
    losses: 0,
    draws: 0,
  },
  {
    registrationId: "901",
    uvsgamesPlayerId: null,
    playerName: "Walk-in",
    rank: 2,
    wins: 3,
    losses: 1,
    draws: 0,
  },
  {
    registrationId: "902",
    uvsgamesPlayerId: 12,
    playerName: "Dropped early",
    rank: null,
    wins: 0,
    losses: 1,
    draws: 0,
  },
];

const CARDS = [
  { zone: "legend", quantity: 1, cardName: "Azir", cardId: "card-azir", preferredPrintingId: null },
  { zone: "main", quantity: 3, cardName: "Shock", cardId: null, preferredPrintingId: null },
];

function args(overrides: Partial<SendTournamentListsArgs> = {}): SendTournamentListsArgs {
  return {
    userId: "user-1",
    tournamentName: "Friday Skirmish",
    uvsgamesEventId: UVS_ID,
    fallbackFormat: null,
    lists: [{ identity: "u11", cards: CARDS }],
    ...overrides,
  };
}

interface HarnessOptions {
  event?: typeof EVENT | undefined;
  live?: boolean;
  liveRows?: { id: string; sourceIdentity: string | null }[];
  existingEventOverlay?: { id: string; status: string };
  existingPlayerOverlays?: { id: string; sourcePlayerKey: string; status: string }[];
  mappedFormat?: boolean;
}

function harness(options: HarnessOptions = {}) {
  const insertEventOverlay = vi.fn().mockResolvedValue("event-overlay-1");
  const updateEventOverlay = vi.fn().mockResolvedValue(undefined);
  const insertPlayerOverlay = vi.fn().mockResolvedValue("player-overlay-1");
  const updatePlayerOverlay = vi.fn().mockResolvedValue(undefined);
  const insertSubmission = vi.fn().mockResolvedValue("submission-1");
  const event = "event" in options ? options.event : EVENT;

  const repos = {
    uvsgamesEvents: {
      byKey: vi.fn().mockResolvedValue(event),
      formatMappings: vi
        .fn()
        .mockResolvedValue(
          new Map(options.mappedFormat === false ? [] : [["constructed", "constructed"]]),
        ),
    },
    uvsgamesResults: { namedStandings: vi.fn().mockResolvedValue(STANDINGS) },
    meta: {
      eventBySourceKey: vi
        .fn()
        .mockResolvedValue(
          options.live === true
            ? { id: META_EVENT_ID, slug: "summoner-skirmish", name: "Summoner Skirmish" }
            : undefined,
        ),
      rawStandingsForEvent: vi.fn().mockResolvedValue(options.liveRows ?? []),
    },
    metaOverlays: {
      eventOverlaysBySourceKeys: vi
        .fn()
        .mockResolvedValue(options.existingEventOverlay ? [options.existingEventOverlay] : []),
      insertEventOverlay,
      updateEventOverlay,
      playerOverlaysBySourceKeys: vi.fn().mockResolvedValue(options.existingPlayerOverlays ?? []),
      insertPlayerOverlay,
      updatePlayerOverlay,
    },
    metaSubmissions: { insert: insertSubmission },
  } as unknown as Repos;

  const transact: Transact = (fn) => fn(repos);
  return {
    repos,
    transact,
    insertEventOverlay,
    updateEventOverlay,
    insertPlayerOverlay,
    updatePlayerOverlay,
    insertSubmission,
  };
}

describe("loadTournamentListTarget", () => {
  it("returns null before the event is mirrored", async () => {
    const h = harness({ event: undefined });
    await expect(loadTournamentListTarget(h.repos, UVS_ID)).resolves.toBeNull();
  });

  it("lists ranked standings under the identity promotion files them under", async () => {
    const h = harness({
      existingPlayerOverlays: [
        { id: "o-1", sourcePlayerKey: playerSourceKey(UVS_ID, "u11"), status: "pending" },
      ],
    });
    const target = await loadTournamentListTarget(h.repos, UVS_ID);
    expect(target?.standings.map((row) => [row.identity, row.rank, row.sentStatus])).toEqual([
      ["u11", 1, "pending"],
      ["r901", 2, null],
    ]);
    expect(target?.metaEvent).toBeNull();
  });
});

describe("sendTournamentLists", () => {
  it("refuses before the standings are mirrored", async () => {
    const h = harness({ event: undefined });
    await expect(sendTournamentLists(h.transact, args())).rejects.toBeInstanceOf(AppError);
  });

  it("refuses while the source has not finished the event", async () => {
    const h = harness({ event: { ...EVENT, displayStatus: "inProgress" } });
    await expect(sendTournamentLists(h.transact, args())).rejects.toThrow(/final standings/u);
  });

  it("proposes an event not yet in the archive and hangs the list off it", async () => {
    const h = harness();
    const result = await sendTournamentLists(h.transact, args());

    expect(result).toMatchObject({ sent: 1, updated: 0, skipped: [] });
    expect(h.insertEventOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: TOURNAMENT_LIST_PROVIDER,
        externalId: UVS_ID,
        metaEventId: null,
        name: "Summoner Skirmish",
        eventDate: "2026-09-12",
        format: "constructed",
        claimedFields: ["name", "eventDate", "format", "playerCount", "organizer"],
      }),
    );
    expect(h.insertPlayerOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: TOURNAMENT_LIST_PROVIDER,
        sourcePlayerKey: playerSourceKey(UVS_ID, "u11"),
        eventOverlayId: "event-overlay-1",
        metaEventPlayerId: null,
        claimedFields: ["listStatus", "cards"],
      }),
      [
        expect.objectContaining({ lineNumber: 0, cardName: "Azir", cardId: "card-azir" }),
        expect.objectContaining({ lineNumber: 1, cardName: "Shock", cardId: null }),
      ],
    );
    expect(h.insertSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: TOURNAMENT_LIST_PROVIDER,
        externalId: playerSourceKey(UVS_ID, "u11"),
        playerOverlayId: "player-overlay-1",
        metaEventId: null,
        playerName: "Nova",
        kind: "new_list",
        note: 'Sent from the OpenRift tournament "Friday Skirmish" for Nova, rank 1 on UVS Games.',
      }),
    );
  });

  it("falls back to the tournament's format when the source format has no mapping", async () => {
    const h = harness({ mappedFormat: false });
    await sendTournamentLists(h.transact, args({ fallbackFormat: "sealed" }));
    expect(h.insertEventOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ format: "sealed" }),
    );
  });

  it("reopens a rejected proposal instead of filing a second one", async () => {
    const h = harness({ existingEventOverlay: { id: "event-overlay-9", status: "rejected" } });
    await sendTournamentLists(h.transact, args());
    expect(h.insertEventOverlay).not.toHaveBeenCalled();
    expect(h.updateEventOverlay).toHaveBeenCalledWith("event-overlay-9", {
      status: "pending",
      acceptedAt: null,
    });
    expect(h.insertPlayerOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ eventOverlayId: "event-overlay-9" }),
      expect.any(Array),
    );
  });

  it("anchors straight to the standings row of an archived event", async () => {
    const h = harness({ live: true, liveRows: [{ id: "row-11", sourceIdentity: "u11" }] });
    await sendTournamentLists(h.transact, args());
    expect(h.insertEventOverlay).not.toHaveBeenCalled();
    expect(h.insertPlayerOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ metaEventPlayerId: "row-11", eventOverlayId: null }),
      expect.any(Array),
    );
    expect(h.insertSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ metaEventId: META_EVENT_ID, metaEventPlayerId: "row-11" }),
    );
  });

  it("skips a standing the archived event does not hold", async () => {
    const h = harness({ live: true, liveRows: [] });
    const result = await sendTournamentLists(h.transact, args());
    expect(result.skipped).toEqual([{ identity: "u11", reason: "unknown_standing" }]);
    expect(h.insertPlayerOverlay).not.toHaveBeenCalled();
  });

  it("skips an identity the source does not rank", async () => {
    const h = harness();
    const result = await sendTournamentLists(
      h.transact,
      args({ lists: [{ identity: "u12", cards: CARDS }] }),
    );
    expect(result.skipped).toEqual([{ identity: "u12", reason: "unknown_standing" }]);
  });

  it("replaces the list of a pending send and files no second ledger row", async () => {
    const h = harness({
      existingPlayerOverlays: [
        { id: "o-1", sourcePlayerKey: playerSourceKey(UVS_ID, "u11"), status: "pending" },
      ],
    });
    const result = await sendTournamentLists(h.transact, args());
    expect(result).toMatchObject({ sent: 0, updated: 1 });
    expect(h.updatePlayerOverlay).toHaveBeenCalledWith(
      "o-1",
      expect.objectContaining({ eventOverlayId: "event-overlay-1" }),
      expect.any(Array),
    );
    expect(h.insertSubmission).not.toHaveBeenCalled();
  });

  it("leaves a list an admin already settled alone", async () => {
    const h = harness({
      existingPlayerOverlays: [
        { id: "o-1", sourcePlayerKey: playerSourceKey(UVS_ID, "u11"), status: "accepted" },
      ],
    });
    const result = await sendTournamentLists(h.transact, args());
    expect(result.skipped).toEqual([{ identity: "u11", reason: "settled" }]);
    expect(h.updatePlayerOverlay).not.toHaveBeenCalled();
  });
});
