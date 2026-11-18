import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { AppError, conflict } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import {
  createManualDeckCheckEntry,
  prepareManualDeckCheckList,
} from "../services/deck-check-ingest.js";
import { linesFromDeckCode } from "../services/deck-check-player.js";
import { tournamentDeckCheckRouter } from "./authenticated-tournament-deck-check.js";

vi.mock("../services/deck-check-ingest.js", async (importOriginal) => ({
  ...(await importOriginal()),
  createManualDeckCheckEntry: vi.fn(),
  prepareManualDeckCheckList: vi.fn(() =>
    Promise.resolve({ lines: [], contentHash: "hash", cardRows: [] }),
  ),
}));
vi.mock("../services/deck-check-player.js", async (importOriginal) => ({
  ...(await importOriginal()),
  linesFromDeckCode: vi.fn(),
}));

const mockCreateManualDeckCheckEntry = vi.mocked(createManualDeckCheckEntry);
const mockPrepareManualDeckCheckList = vi.mocked(prepareManualDeckCheckList);
const mockLinesFromDeckCode = vi.mocked(linesFromDeckCode);

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const TOURNAMENT_ID = "b0000000-0001-4000-a000-000000000001";
const ENTRY_ID = "c0000000-0001-4000-a000-000000000001";

const now = new Date("2026-06-01T00:00:00Z");

const event = {
  id: TOURNAMENT_ID,
  groupId: null,
  name: "Summoner Skirmish",
  eventDate: null,
  format: "constructed",
  playMode: "1v1" as const,
  allowedSets: null,
  status: "active" as "active" | "archived",
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

describe("POST /tournaments/{tournamentId}/deck-check/entries", () => {
  const PARTICIPANT_ID = "e0000000-0001-4000-a000-000000000001";

  function makeCreateApp() {
    const repos = {
      deckCheck: {
        getEventById: vi.fn(() => Promise.resolve(event)),
        participantHasDeck: vi.fn(() => Promise.resolve(false)),
      },
      tournaments: {
        isHostOrStaff: vi.fn(() => Promise.resolve(true)),
        getParticipantById: vi.fn(() =>
          Promise.resolve({ id: PARTICIPANT_ID, tournamentId: TOURNAMENT_ID }),
        ),
        lockParticipant: vi.fn(() => Promise.resolve(true)),
        lockRounds: vi.fn(() => Promise.resolve()),
      },
    };
    const app = new Hono<{ Variables: Variables }>();
    app.use("*", async (c, next) => {
      c.set("user", { id: USER_ID } as never);
      c.set("repos", repos as never);
      c.set("transact", (async (fn: (r: typeof repos) => unknown) => fn(repos)) as never);
      await next();
    });
    registerRouterForTest(app, tournamentDeckCheckRouter);
    app.onError((err, c) => {
      if (err instanceof AppError) {
        return c.json({ error: err.message, code: err.code }, err.status as 409);
      }
      throw err;
    });
    return { app, repos };
  }

  function post(app: Hono<{ Variables: Variables }>, body: unknown) {
    return app.request(`/api/v1/tournaments/${TOURNAMENT_ID}/deck-check/entries`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("decodes a deck code into card lines with their zones", async () => {
    mockLinesFromDeckCode.mockResolvedValueOnce([
      { name: "Some Legend", zone: "legend", quantity: 1 },
      { name: "Some Card", zone: "main", quantity: 3 },
    ]);
    mockCreateManualDeckCheckEntry.mockRejectedValueOnce(conflict("stop"));

    const res = await post(makeCreateApp().app, {
      participantId: PARTICIPANT_ID,
      deckCode: "CMAAAAABAEAABJQB",
    });

    expect(res.status).toBe(409);
    expect(mockLinesFromDeckCode).toHaveBeenCalledWith(expect.anything(), "CMAAAAABAEAABJQB");
    expect(mockPrepareManualDeckCheckList).toHaveBeenCalledWith(expect.anything(), [
      { name: "Some Legend", quantity: 1, section: "legend" },
      { name: "Some Card", quantity: 3, section: "main" },
    ]);
    expect(mockCreateManualDeckCheckEntry).toHaveBeenCalledWith(
      expect.anything(),
      TOURNAMENT_ID,
      PARTICIPANT_ID,
      { lines: [], contentHash: "hash", cardRows: [] },
    );
  });

  it("rejects a deck code sent together with a card list", async () => {
    const res = await post(makeCreateApp().app, {
      participantId: PARTICIPANT_ID,
      deckCode: "CMAAAAABAEAABJQB",
      cards: [{ name: "Some Card", quantity: 1, section: "main" }],
    });

    expect(res.status).toBe(400);
    expect(mockCreateManualDeckCheckEntry).not.toHaveBeenCalled();
  });

  it("resolves the list before it takes the rounds lock", async () => {
    const { app, repos } = makeCreateApp();
    mockCreateManualDeckCheckEntry.mockRejectedValueOnce(conflict("stop"));

    await post(app, {
      participantId: PARTICIPANT_ID,
      cards: [{ name: "Some Card", quantity: 1, section: "main" }],
    });

    const [resolveOrder] = mockPrepareManualDeckCheckList.mock.invocationCallOrder.slice(-1);
    const [lockOrder] = repos.tournaments.lockRounds.mock.invocationCallOrder;
    expect(resolveOrder).toBeLessThan(lockOrder ?? 0);
  });
});

describe("PATCH /tournaments/{tournamentId}/deck-check/entries/{entryId}", () => {
  const PARTICIPANT_ID = "e0000000-0001-4000-a000-000000000001";

  it("refuses a rename once the player's account closed while the edit waited", async () => {
    const open = {
      ...entry("submitted"),
      participantId: PARTICIPANT_ID as string | null,
      playerName: "Player One" as string | null,
    };
    const deckCheck = {
      getEventById: vi.fn(() => Promise.resolve(event)),
      getEntry: vi.fn(() => Promise.resolve(open)),
      listEditableBaselines: vi.fn(() => Promise.resolve([])),
      updateEntry: vi.fn(),
    };
    const tournaments = {
      isHostOrStaff: vi.fn(() => Promise.resolve(true)),
      lockRounds: vi.fn(() => Promise.resolve()),
      lockParticipant: vi.fn(() => {
        deckCheck.getEntry.mockResolvedValue({ ...open, playerName: null });
        return Promise.resolve(true);
      }),
    };
    const repos = { deckCheck, tournaments };
    const app = new Hono<{ Variables: Variables }>();
    app.use("*", async (c, next) => {
      c.set("user", { id: USER_ID } as never);
      c.set("repos", repos as never);
      c.set("transact", (async (fn: (r: typeof repos) => unknown) => fn(repos)) as never);
      await next();
    });
    registerRouterForTest(app, tournamentDeckCheckRouter);

    const res = await app.request(
      `/api/v1/tournaments/${TOURNAMENT_ID}/deck-check/entries/${ENTRY_ID}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerName: "Jinx" }),
      },
    );

    expect(res.status).toBe(409);
    expect(tournaments.lockParticipant).toHaveBeenCalledWith(PARTICIPANT_ID);
    expect(deckCheck.updateEntry).not.toHaveBeenCalled();
  });
});
