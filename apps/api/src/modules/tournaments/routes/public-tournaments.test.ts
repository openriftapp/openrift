import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { Repos, Transact } from "../../../deps.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import {
  participantDisplayName,
  publicTournamentsRouter,
  resolveSelfJoin,
} from "./public-tournaments.js";

const USER = { id: "user-1", name: "Ashe", email: "ashe@example.com" };
const TOURNAMENT_ID = "tournament-1";
const SUBMIT_TOKEN = "submit-token";

const OPEN_TOURNAMENT = {
  id: TOURNAMENT_ID,
  status: "setup",
  selfRegistration: true,
  submissionToken: SUBMIT_TOKEN,
};

function reposStub(overrides: {
  findByUser: (...args: unknown[]) => Promise<unknown>;
  createParticipant: (...args: unknown[]) => Promise<unknown>;
  lockedTournament?: Record<string, unknown>;
}) {
  const getParticipantByUser = vi.fn(overrides.findByUser);
  const createParticipant = vi.fn(overrides.createParticipant);
  const lockRounds = vi.fn(() => Promise.resolve());
  const getById = vi.fn(() => Promise.resolve(overrides.lockedTournament ?? OPEN_TOURNAMENT));
  const repos = {
    tournaments: { getParticipantByUser, createParticipant, lockRounds, getById },
  } as unknown as Repos;
  const transact: Transact = (fn) => fn(repos);
  return { repos, transact, getParticipantByUser, createParticipant, lockRounds, getById };
}

function join(stub: { repos: Repos; transact: Transact }) {
  return resolveSelfJoin(stub.repos, stub.transact, TOURNAMENT_ID, SUBMIT_TOKEN, USER);
}

describe("participantDisplayName", () => {
  it("uses the account name when present", () => {
    expect(participantDisplayName("Rift Walker", "someone@example.com")).toBe("Rift Walker");
  });

  it("never exposes the raw email: falls back to the local part", () => {
    expect(participantDisplayName(null, "someone@example.com")).toBe("someone");
    expect(participantDisplayName(undefined, "someone@example.com")).toBe("someone");
  });

  it("treats a blank name as missing", () => {
    expect(participantDisplayName("   ", "someone@example.com")).toBe("someone");
    expect(participantDisplayName("", "someone@example.com")).toBe("someone");
  });

  it("falls back to a generic name for a degenerate email", () => {
    expect(participantDisplayName(null, "@example.com")).toBe("Player");
  });
});

describe("resolveSelfJoin", () => {
  it("returns the existing spot without inserting", async () => {
    const stub = reposStub({
      findByUser: async () => ({ id: "p-existing", status: "approved" }),
      createParticipant: async () => ({ id: "p-new", status: "requested" }),
    });
    const result = await join(stub);
    expect(result).toEqual({
      participantId: "p-existing",
      status: "approved",
      alreadyJoined: true,
    });
    expect(stub.createParticipant).not.toHaveBeenCalled();
  });

  it("creates a requested participant when none exists", async () => {
    const stub = reposStub({
      findByUser: async () => undefined,
      createParticipant: async () => ({ id: "p-new", status: "requested" }),
    });
    const result = await join(stub);
    expect(result).toEqual({ participantId: "p-new", status: "requested", alreadyJoined: false });
  });

  it("checks the tournament it read under the rounds lock", async () => {
    const stub = reposStub({
      findByUser: async () => undefined,
      createParticipant: async () => ({ id: "p-new", status: "requested" }),
      lockedTournament: { ...OPEN_TOURNAMENT, status: "cancelled" },
    });
    await expect(join(stub)).rejects.toMatchObject({ status: 409 });
    const lockOrder = stub.lockRounds.mock.invocationCallOrder[0] ?? 0;
    expect(lockOrder).toBeGreaterThan(0);
    expect(lockOrder).toBeLessThan(stub.getById.mock.invocationCallOrder[0] ?? 0);
    expect(stub.createParticipant).not.toHaveBeenCalled();
  });

  it.each([
    ["self-registration closed", { selfRegistration: false }, 403],
    ["the link turned off", { submissionToken: null }, 404],
  ])("refuses a join once %s while it waited", async (_label, change, status) => {
    const stub = reposStub({
      findByUser: async () => undefined,
      createParticipant: async () => ({ id: "p-new", status: "requested" }),
      lockedTournament: { ...OPEN_TOURNAMENT, ...change },
    });
    await expect(join(stub)).rejects.toMatchObject({ status });
    expect(stub.createParticipant).not.toHaveBeenCalled();
  });

  it("resolves to the race winner when the insert hits a unique violation", async () => {
    const findByUser = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: "p-race", status: "requested" });
    const stub = reposStub({
      findByUser,
      createParticipant: async () => {
        throw Object.assign(new Error("duplicate key"), {
          code: "23505",
          constraint_name: "uq_tournament_participants_user",
        });
      },
    });
    const result = await join(stub);
    expect(result).toEqual({ participantId: "p-race", status: "requested", alreadyJoined: true });
  });

  it("re-throws a unique violation on another constraint", async () => {
    const other = Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint_name: "tournament_participants_pkey",
    });
    const stub = reposStub({
      findByUser: async () => undefined,
      createParticipant: async () => {
        throw other;
      },
    });
    await expect(join(stub)).rejects.toBe(other);
  });

  it("re-throws a non-unique insert error", async () => {
    const boom = new Error("connection reset");
    const stub = reposStub({
      findByUser: async () => undefined,
      createParticipant: async () => {
        throw boom;
      },
    });
    await expect(join(stub)).rejects.toBe(boom);
  });
});

describe("landing", () => {
  function landingApp(status: string) {
    const app = new Hono<{ Variables: Variables }>();
    app.use("*", async (c, next) => {
      c.set("user", { id: USER.id } as never);
      c.set("repos", {
        tournaments: {
          getBySubmissionToken: vi.fn(() =>
            Promise.resolve({
              id: TOURNAMENT_ID,
              name: "Summoner Skirmish",
              hostType: "user",
              hostUserId: null,
              hostOrgId: null,
              selfRegistration: true,
              deckSubmission: "none",
            }),
          ),
          getParticipantByUser: vi.fn(() => Promise.resolve({ id: "participant-1", status })),
        },
      } as never);
      await next();
    });
    registerRouterForTest(app, publicTournamentsRouter);
    return app;
  }

  it.each(["requested", "invited", "active", "dropped", "no_show"])(
    "reports a %s viewer's participant status",
    async (status) => {
      const res = await landingApp(status).request("/api/v1/tournaments/submit/submit-token");
      expect(res.status).toBe(200);
      expect(await readJson(res)).toMatchObject({
        viewerIsParticipant: true,
        viewerParticipantStatus: status,
      });
    },
  );
});

const INVITE_TOKEN = "staffinvite01";
const HOST_USER_ID = "host-1";

function makeStaffInviteApp(overrides: {
  user?: { id: string } | null;
  tournaments?: Record<string, unknown>;
}) {
  const app = new Hono<{ Variables: Variables }>();
  app.use("*", async (c, next) => {
    c.set("user", (overrides.user ?? null) as never);
    c.set("repos", {
      tournaments: {
        getByStaffInviteToken: vi.fn(() =>
          Promise.resolve({
            tournament: {
              id: TOURNAMENT_ID,
              name: "Summoner Skirmish",
              hostType: "user",
              hostUserId: HOST_USER_ID,
              hostOrgId: null,
            },
            role: "judge",
          }),
        ),
        getUserNames: vi.fn(() => Promise.resolve(new Map([[HOST_USER_ID, "Rift Warden"]]))),
        isHostOrStaff: vi.fn(() => Promise.resolve(false)),
        ...overrides.tournaments,
      },
    } as never);
    await next();
  });
  registerRouterForTest(app, publicTournamentsRouter);
  return app;
}

describe("staffInviteLanding", () => {
  it("tells a signed-out invitee which event and role the link is for", async () => {
    const app = makeStaffInviteApp({ user: null });
    const res = await app.request(`/api/v1/tournaments/staff-invite/${INVITE_TOKEN}`);
    expect(res.status).toBe(200);
    const body = (await readJson(res)) as {
      name: string;
      hostDisplayName: string;
      role: string;
      alreadyStaff: boolean;
    };
    expect(body.name).toBe("Summoner Skirmish");
    expect(body.hostDisplayName).toBe("Rift Warden");
    expect(body.role).toBe("judge");
    expect(body.alreadyStaff).toBe(false);
  });

  it("never checks staff membership without a session", async () => {
    const isHostOrStaff = vi.fn(() => Promise.resolve(false));
    const app = makeStaffInviteApp({ user: null, tournaments: { isHostOrStaff } });
    await app.request(`/api/v1/tournaments/staff-invite/${INVITE_TOKEN}`);
    expect(isHostOrStaff).not.toHaveBeenCalled();
  });

  it("reports the role a signed-in viewer already holds", async () => {
    const app = makeStaffInviteApp({
      user: { id: "judge-1" },
      tournaments: { isHostOrStaff: vi.fn(() => Promise.resolve(true)) },
    });
    const res = await app.request(`/api/v1/tournaments/staff-invite/${INVITE_TOKEN}`);
    const body = (await readJson(res)) as { alreadyStaff: boolean };
    expect(body.alreadyStaff).toBe(true);
  });

  it("returns 404 for a token that matches nothing", async () => {
    const app = makeStaffInviteApp({
      user: null,
      tournaments: { getByStaffInviteToken: vi.fn(() => Promise.resolve(undefined)) },
    });
    const res = await app.request(`/api/v1/tournaments/staff-invite/${INVITE_TOKEN}`);
    expect(res.status).toBe(404);
  });
});
