import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { AppError } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { tournamentDeckCheckRouter } from "./authenticated-tournament-deck-check.js";

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const TOURNAMENT_ID = "b0000000-0001-4000-a000-000000000001";
const ENTRY_ID = "c0000000-0001-4000-a000-000000000001";

const now = new Date("2026-06-01T00:00:00Z");

const event = {
  id: TOURNAMENT_ID,
  groupId: null,
  name: "Summoner Skirmish",
  eventDate: null,
  format: null,
  playMode: "1v1" as const,
  allowedSets: null,
  status: "active" as const,
  listLockMode: "manual" as const,
  allowSelfSubmission: true,
  submissionToken: null,
  submissionsCloseAt: null,
  createdAt: now,
  updatedAt: now,
};

function entry(state: "submitted" | "approved") {
  return {
    id: ENTRY_ID,
    tournamentId: TOURNAMENT_ID,
    participantId: null,
    externalId: "ext-1",
    submittedAt: now,
    allowDeckPublishing: true,
    allowNameSharing: true,
    allowRiotIdSharing: true,
    contentHash: "hash",
    state,
    reviewOutcome: state === "approved" ? "ok" : null,
    checkedBy: null,
    checkedAt: null,
    approvedBy: state === "approved" ? USER_ID : null,
    approvedAt: state === "approved" ? now : null,
    unlockRequestedAt: null,
    preEditLines: null,
    notes: null,
    changeSummary: null,
    withdrawnAt: null,
    playerMessage: null,
    createdAt: now,
    updatedAt: now,
    playerName: "Player One",
    riotId: null,
    claimedUserId: null,
    claimSource: null,
    claimedAt: null,
    claimBlockedAt: null,
    claimToken: null,
  };
}

function makeApp() {
  const tournaments = { isHostOrStaff: vi.fn(() => Promise.resolve(true)) };

  // What authorizeJudge and loadEntry see: the state at the start of the
  // request, before a concurrent judge's commit lands.
  const outerDeckCheck = {
    getEventById: vi.fn(() => Promise.resolve(event)),
    getEntry: vi.fn(() => Promise.resolve(entry("submitted"))),
    updateEntry: vi.fn(() => Promise.resolve(entry("submitted"))),
  };
  const outerRepos = { deckCheck: outerDeckCheck, tournaments };

  // What context.transact sees: a concurrent judge has already committed the
  // entry into "approved" by the time this request's transaction opens.
  const txDeckCheck = {
    getEntryForUpdate: vi.fn(() => Promise.resolve(entry("approved"))),
    updateEntry: vi.fn(() => Promise.resolve(entry("approved"))),
  };
  const txRepos = { deckCheck: txDeckCheck, tournaments };

  const app = new Hono<{ Variables: Variables }>();
  app.use("*", async (c, next) => {
    c.set("user", { id: USER_ID } as never);
    c.set("repos", outerRepos as never);
    c.set("transact", (async (fn: (repos: typeof txRepos) => unknown) => fn(txRepos)) as never);
    await next();
  });
  registerRouterForTest(app, tournamentDeckCheckRouter);
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.status as 409);
    }
    throw err;
  });

  return { app, outerDeckCheck, txDeckCheck };
}

describe("PUT /tournaments/{tournamentId}/deck-check/entries/{entryId}/state", () => {
  it("rejects a transition validated against a stale snapshot and writes nothing", async () => {
    const { app, txDeckCheck } = makeApp();

    const res = await app.request(
      `/api/v1/tournaments/${TOURNAMENT_ID}/deck-check/entries/${ENTRY_ID}/state`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: "approved" }),
      },
    );

    expect(res.status).toBe(409);
    const body = (await readJson(res)) as { code: string };
    expect(body.code).toBe("CONFLICT");
    expect(txDeckCheck.getEntryForUpdate).toHaveBeenCalledWith(TOURNAMENT_ID, ENTRY_ID);
    expect(txDeckCheck.updateEntry).not.toHaveBeenCalled();
  });
});

describe("deadline auto-submit", () => {
  const CARD_ID = "d0000000-0001-4000-a000-000000000001";
  const closeAt = new Date("2020-06-01T12:00:00Z");
  const closedEvent = {
    ...event,
    listLockMode: "at_deadline" as const,
    submissionsCloseAt: closeAt,
  };
  const editable = { ...entry("submitted"), state: "editable", submittedAt: null };

  function makeDeadlineApp() {
    const deckCheck = {
      getEventById: vi.fn(() => Promise.resolve(closedEvent)),
      getEntry: vi.fn((): Promise<unknown> => Promise.resolve(editable)),
      listEntriesForEvent: vi.fn(() =>
        Promise.resolve([
          {
            ...editable,
            checkedByName: null,
            approvedByName: null,
            claimedUserName: null,
            participantStatus: null,
            copyCount: 40,
            verifiedCopyCount: 0,
            unmatchedLineCount: 0,
          },
        ]),
      ),
      listCardsForEntries: vi.fn(() => Promise.resolve(new Map())),
      listEditableBaselines: vi.fn(() =>
        Promise.resolve([{ id: ENTRY_ID, preEditLines: null, updatedAt: now }]),
      ),
      settleEditableEntries: vi.fn(() => Promise.resolve([ENTRY_ID])),
      setCardCopyFound: vi.fn(() => Promise.resolve(true)),
      updateEntry: vi.fn(),
    };
    const repos = {
      deckCheck,
      tournaments: { isHostOrStaff: vi.fn(() => Promise.resolve(true)) },
    };
    const app = new Hono<{ Variables: Variables }>();
    app.use("*", async (c, next) => {
      c.set("user", { id: USER_ID } as never);
      c.set("repos", repos as never);
      c.set("transact", (async (fn: (r: typeof repos) => unknown) => fn(repos)) as never);
      await next();
    });
    registerRouterForTest(app, tournamentDeckCheckRouter);
    return { app, deckCheck };
  }

  it("lists an entry left editable past the deadline as submitted without writing", async () => {
    const { app, deckCheck } = makeDeadlineApp();

    const res = await app.request(`/api/v1/tournaments/${TOURNAMENT_ID}/deck-check/entries`);
    const body = (await readJson(res)) as {
      entries: { state: string; submittedAt: string | null; copyCount: number }[];
    };

    expect(res.status).toBe(200);
    expect(body.entries).toEqual([
      expect.objectContaining({
        state: "submitted",
        submittedAt: closeAt.toISOString(),
        copyCount: 40,
      }),
    ]);
    expect(deckCheck.settleEditableEntries).not.toHaveBeenCalled();
    expect(deckCheck.updateEntry).not.toHaveBeenCalled();
  });

  it("persists the deadline submit in one update before a judge write", async () => {
    const { app, deckCheck } = makeDeadlineApp();
    deckCheck.getEntry.mockResolvedValue(entry("submitted"));

    const res = await app.request(
      `/api/v1/tournaments/${TOURNAMENT_ID}/deck-check/entries/${ENTRY_ID}/cards/${CARD_ID}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ copyIndex: 0, found: true }),
      },
    );

    expect(res.status).toBe(204);
    expect(deckCheck.settleEditableEntries).toHaveBeenCalledTimes(1);
    expect(deckCheck.settleEditableEntries).toHaveBeenCalledWith(TOURNAMENT_ID, [
      { id: ENTRY_ID, submittedAt: closeAt, changeSummary: null },
    ]);
    expect(deckCheck.updateEntry).not.toHaveBeenCalled();
    expect(deckCheck.setCardCopyFound).toHaveBeenCalledWith(ENTRY_ID, CARD_ID, 0, true);
  });
});
