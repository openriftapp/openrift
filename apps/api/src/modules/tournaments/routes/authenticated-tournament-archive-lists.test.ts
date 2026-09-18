import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { AppError } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
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

function makeApp(options: { manager?: boolean; tournament?: Record<string, unknown> } = {}) {
  const sendTournamentLists = vi.fn((_transact: unknown, args: { lists: { identity: string }[] }) =>
    Promise.resolve({
      eventName: "Summoner Skirmish",
      sent: args.lists.length,
      updated: 0,
      skipped: [],
    }),
  );
  const notifyAdminsOfMetaSubmission = vi.fn(() => Promise.resolve());
  const repos = {
    tournaments: {
      findById: vi.fn(() => Promise.resolve(tournament(options.tournament))),
      isHostOrStaff: vi.fn(() => Promise.resolve(options.manager ?? true)),
    },
    deckCheck: {
      listEntriesForEvent: vi.fn(() =>
        Promise.resolve([
          entry(READY, "checked"),
          entry(UNCHECKED, "submitted"),
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
    c.set("services", { sendTournamentLists, notifyAdminsOfMetaSubmission } as never);
    await next();
  });
  registerRouterForTest(app, tournamentArchiveListsRouter);
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.status as 409);
    }
    throw err;
  });
  return { app, sendTournamentLists, notifyAdminsOfMetaSubmission };
}

function send(app: Hono<{ Variables: Variables }>, links: unknown[]) {
  return app.request(`/api/v1/tournaments/${TOURNAMENT_ID}/archive-lists/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ links }),
  });
}

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
