import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

const { createMetaSyncDeps } = vi.hoisted(() => ({
  createMetaSyncDeps: vi.fn((_env: unknown) => ({})),
}));

vi.mock("../../meta/services/meta-sync/index.js", () => ({ createMetaSyncDeps }));

import { AppError } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { SourceThrottledError } from "../../meta/services/meta-sync/source-http.js";
import { fetchUvsgamesEvent as fetchUvsgamesEventForReal } from "../../meta/services/meta-sync/uvsgames-on-demand.js";
import { tournamentArchiveListsRouter } from "./authenticated-tournament-archive-lists.js";

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const TOURNAMENT_ID = "b0000000-0001-4000-a000-000000000001";
const READY = "c0000000-0001-4000-a000-000000000001";
const UNCHECKED = "c0000000-0002-4000-a000-000000000002";
const NO_CONSENT = "c0000000-0003-4000-a000-000000000003";
const NO_ENTRY = "c0000000-0004-4000-a000-000000000004";

function tournament(overrides: Record<string, unknown> = {}) {
  return {
    id: TOURNAMENT_ID,
    name: "Friday Skirmish",
    status: "completed",
    startsAt: new Date("2026-09-12T16:00:00Z"),
    endsAt: null,
    deckSubmission: "required",
    deckFormat: "constructed",
    uvsgamesEventId: "667904",
    groupId: null,
    submissionsCloseAt: null,
    ...overrides,
  };
}

function entry(participantId: string, state: string, allowDeckPublishing = true) {
  return {
    id: `entry-${participantId}`,
    participantId,
    state,
    allowDeckPublishing,
    allowNameSharing: true,
    unmatchedLineCount: 0,
  };
}

function makeApp(
  options: {
    manager?: boolean;
    tournament?: Record<string, unknown>;
    uncheckedState?: string;
    fetchUvsgamesEvent?: (...args: never[]) => Promise<unknown>;
  } = {},
) {
  const sendTournamentLists = vi.fn((_transact: unknown, args: { lists: { identity: string }[] }) =>
    Promise.resolve({
      eventName: "Summoner Skirmish",
      sent: args.lists.length,
      updated: 0,
      skipped: [],
    }),
  );
  const notifyAdminsOfMetaSubmission = vi.fn(() => Promise.resolve());
  const fetchUvsgamesEvent = vi.fn(
    options.fetchUvsgamesEvent ?? (() => Promise.resolve({ status: "fetched", errors: [] })),
  );
  const repos = {
    tournaments: {
      getById: vi.fn(() => Promise.resolve(tournament(options.tournament))),
      isHostOrStaff: vi.fn(() => Promise.resolve(options.manager ?? true)),
      listParticipants: vi.fn(() =>
        Promise.resolve(
          [READY, UNCHECKED, NO_CONSENT].map((id) => ({
            id,
            displayName: `Player ${id.slice(-1)}`,
            status: "active",
          })),
        ),
      ),
    },
    deckCheck: {
      listEntriesForEvent: vi.fn(() =>
        Promise.resolve([
          entry(READY, "checked"),
          entry(UNCHECKED, options.uncheckedState ?? "submitted"),
          entry(NO_CONSENT, "checked", false),
        ]),
      ),
      listCardsForEntry: vi.fn(() =>
        Promise.resolve([
          {
            zone: "legend",
            quantity: 1,
            rawName: "Azir",
            resolvedCardId: "card-azir",
            resolvedPrintingId: "printing-azir",
          },
        ]),
      ),
    },
  };

  const app = new Hono<{ Variables: Variables }>();
  app.use("*", async (c, next) => {
    c.set("user", { id: USER_ID } as never);
    c.set("repos", repos as never);
    c.set("transact", (async (fn: (r: typeof repos) => unknown) => fn(repos)) as never);
    c.set("services", {
      sendTournamentLists,
      notifyAdminsOfMetaSubmission,
      fetchUvsgamesEvent,
      loadTournamentListTarget: vi.fn(() => Promise.resolve(null)),
    } as never);
    c.set("config", { metaSync: { baseUrl: "http://upstream.test" } } as never);
    c.set("io", { fetch: vi.fn() } as never);
    await next();
  });
  registerRouterForTest(app, tournamentArchiveListsRouter);
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.status as 409);
    }
    throw err;
  });
  return { app, sendTournamentLists, notifyAdminsOfMetaSubmission, fetchUvsgamesEvent };
}

function send(app: Hono<{ Variables: Variables }>, links: unknown[]) {
  return app.request(`/api/v1/tournaments/${TOURNAMENT_ID}/archive-lists/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ links }),
  });
}

describe("GET /tournaments/{id}/archive-lists", () => {
  it("shows a list left editable when the tournament ended as submitted", async () => {
    const { app } = makeApp({ tournament: { uvsgamesEventId: null }, uncheckedState: "editable" });

    const res = await app.request(`/api/v1/tournaments/${TOURNAMENT_ID}/archive-lists`);
    const body = (await readJson(res)) as {
      participants: { participantId: string; entryState: string | null }[];
    };

    expect(res.status).toBe(200);
    expect(body.participants.find((row) => row.participantId === UNCHECKED)?.entryState).toBe(
      "submitted",
    );
  });
});

describe("POST /tournaments/{id}/archive-lists/refresh", () => {
  it("answers a throttled upstream with a failed refresh, not an error", async () => {
    const setRecheck = vi.fn(() => Promise.resolve());
    const mirrored = {
      externalId: "667904",
      name: "Friday Skirmish",
      displayStatus: "complete",
      nextCheckAt: new Date(),
      checkStage: 0,
      resultsFetchedAt: null,
    };
    createMetaSyncDeps.mockReturnValueOnce({
      repos: {
        uvsgamesEvents: {
          byKey: () => Promise.resolve(mirrored),
          upsertBatch: () => Promise.resolve({ inserted: [], changed: [], unchanged: [] }),
          setRecheck,
        },
      },
      client: {
        requests: 0,
        get: () =>
          Promise.resolve({
            id: 667_904,
            name: "Friday Skirmish",
            game_type: "RIFTBOUND",
            start_datetime: "2026-09-12T16:00:00Z",
            display_status: "complete",
            event_format: "CONSTRUCTED",
          }),
        page: (path: string) => Promise.reject(new SourceThrottledError(path)),
      },
      log: { info: vi.fn(), warn: vi.fn() },
    });
    const { app } = makeApp({ fetchUvsgamesEvent: fetchUvsgamesEventForReal as never });

    const res = await app.request(`/api/v1/tournaments/${TOURNAMENT_ID}/archive-lists/refresh`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    expect(((await readJson(res)) as { outcome: string }).outcome).toBe("failed");
    expect(createMetaSyncDeps).toHaveBeenCalledWith(expect.objectContaining({ interactive: true }));
  });
});

describe("POST /tournaments/{id}/archive-lists/send", () => {
  it("is for the host and organizers only", async () => {
    const { app, sendTournamentLists } = makeApp({ manager: false });
    const res = await send(app, [{ participantId: READY, identity: "u11" }]);
    expect(res.status).toBe(403);
    expect(sendTournamentLists).not.toHaveBeenCalled();
  });

  it("needs a linked UVS Games event", async () => {
    const { app } = makeApp({ tournament: { uvsgamesEventId: null } });
    const res = await send(app, [{ participantId: READY, identity: "u11" }]);
    expect(res.status).toBe(409);
  });

  it("waits for the tournament to end", async () => {
    const { app } = makeApp({
      tournament: { status: "running", startsAt: new Date(Date.now() - 60_000), endsAt: null },
    });
    const res = await send(app, [{ participantId: READY, identity: "u11" }]);
    expect(res.status).toBe(409);
  });

  it("sends ready and forced lists and skips the rest", async () => {
    const { app, sendTournamentLists, notifyAdminsOfMetaSubmission } = makeApp();
    const res = await send(app, [
      { participantId: READY, identity: "u11" },
      { participantId: UNCHECKED, identity: "u12" },
      { participantId: UNCHECKED, identity: "u13", force: true },
      { participantId: NO_CONSENT, identity: "u14", force: true },
      { participantId: NO_ENTRY, identity: "u15", force: true },
    ]);

    expect(res.status).toBe(200);
    const body = (await readJson(res)) as { sent: number; skipped: unknown[] };
    expect(body.sent).toBe(2);
    expect(body.skipped).toEqual([
      { participantId: UNCHECKED, reason: "not_eligible" },
      { participantId: NO_CONSENT, reason: "not_eligible" },
      { participantId: NO_ENTRY, reason: "not_eligible" },
    ]);
    expect(sendTournamentLists).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        uvsgamesEventId: "667904",
        fallbackFormat: "constructed",
        lists: [
          {
            identity: "u11",
            cards: [
              {
                zone: "legend",
                quantity: 1,
                cardName: "Azir",
                cardId: "card-azir",
                preferredPrintingId: "printing-azir",
              },
            ],
          },
          expect.objectContaining({ identity: "u13" }),
        ],
      }),
    );
    expect(notifyAdminsOfMetaSubmission).toHaveBeenCalledTimes(1);
  });

  it("answers without waiting for the admin email to go out", async () => {
    const { app, notifyAdminsOfMetaSubmission } = makeApp();
    notifyAdminsOfMetaSubmission.mockReturnValue(Promise.withResolvers<void>().promise);

    const res = await send(app, [{ participantId: READY, identity: "u11" }]);

    expect(res.status).toBe(200);
    expect(notifyAdminsOfMetaSubmission).toHaveBeenCalledTimes(1);
  });

  it("files one standings row once", async () => {
    const { app, sendTournamentLists } = makeApp();
    const res = await send(app, [
      { participantId: READY, identity: "u11" },
      { participantId: UNCHECKED, identity: "u11", force: true },
    ]);
    const body = (await readJson(res)) as { skipped: unknown[] };
    expect(body.skipped).toEqual([{ participantId: UNCHECKED, reason: "duplicate_standing" }]);
    expect(sendTournamentLists).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ lists: [expect.objectContaining({ identity: "u11" })] }),
    );
  });
});
