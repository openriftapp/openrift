import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestContext,
  createUnauthenticatedTestContext,
  req,
} from "../../../test/integration-context.js";
import { readJson } from "../../../test/read-json.js";
import { holdRow, waitUntilBlockedBy } from "../../../test/row-locks.js";

const HOST_ID = crypto.randomUUID();
const JOINER_ID = crypto.randomUUID();

const hostCtx = createTestContext(HOST_ID, `test-${HOST_ID}@test.com`);
const joinerCtx = createTestContext(JOINER_ID, `test-${JOINER_ID}@test.com`);
const anonCtx = createUnauthenticatedTestContext();

const ALL_IDS = [HOST_ID, JOINER_ID];

describe.skipIf(!hostCtx || !joinerCtx || !anonCtx)(
  "Public tournament request-to-join (integration)",
  () => {
    const host = hostCtx!;
    const joiner = joinerCtx!;
    const anon = anonCtx!;
    let id = "";
    let token = "";

    beforeAll(async () => {
      for (const userId of ALL_IDS) {
        await host.db
          .insertInto("users")
          .values({
            id: userId,
            email: `test-${userId}@test.com`,
            name: "T",
            emailVerified: true,
            image: null,
          })
          .execute();
      }
      const create = await host.app.fetch(
        req("POST", "/tournaments", {
          name: "Open Store Event",
          host: { type: "user" },
          pairingStyle: "none",
          deckSubmission: "optional",
          startsAt: "2026-06-01T12:00:00Z",
          selfRegistration: true,
        }),
      );
      id = ((await readJson(create)) as { id: string }).id;
      const enabled = await host.app.fetch(req("POST", `/tournaments/${id}/submission-token`));
      token = ((await readJson(enabled)) as { submissionToken: string }).submissionToken;
    });

    afterAll(async () => {
      await host.db.deleteFrom("tournaments").where("hostUserId", "in", ALL_IDS).execute();
      await host.db.deleteFrom("users").where("id", "in", ALL_IDS).execute();
    });

    it("serves the landing (no auth) and 404s an unknown token", async () => {
      const res = await anon.app.fetch(req("GET", `/tournaments/submit/${token}`));
      expect(res.status).toBe(200);
      const body = (await readJson(res)) as {
        name: string;
        selfRegistrationOpen: boolean;
        deckExpected: boolean;
        viewerIsParticipant: boolean;
      };
      expect(body.name).toBe("Open Store Event");
      expect(body.selfRegistrationOpen).toBe(true);
      expect(body.deckExpected).toBe(true);
      expect(body.viewerIsParticipant).toBe(false);

      const missing = await anon.app.fetch(req("GET", "/tournaments/submit/nope"));
      expect(missing.status).toBe(404);
    });

    it("requires a session to request to join", async () => {
      const res = await anon.app.fetch(req("POST", `/tournaments/submit/${token}/request`));
      expect(res.status).toBe(401);
    });

    it("creates a requested participant and is idempotent per account", async () => {
      const first = await joiner.app.fetch(req("POST", `/tournaments/submit/${token}/request`));
      expect(first.status).toBe(200);
      const firstBody = (await readJson(first)) as {
        participantId: string;
        status: string;
        alreadyJoined: boolean;
      };
      expect(firstBody.status).toBe("requested");
      expect(firstBody.alreadyJoined).toBe(false);

      const second = await joiner.app.fetch(req("POST", `/tournaments/submit/${token}/request`));
      expect(second.status).toBe(200);
      const secondBody = (await readJson(second)) as {
        participantId: string;
        alreadyJoined: boolean;
      };
      expect(secondBody.participantId).toBe(firstBody.participantId);
      expect(secondBody.alreadyJoined).toBe(true);
    });

    it("reports the signed-in viewer's participant status on the landing", async () => {
      const hostView = await host.app.fetch(req("GET", `/tournaments/submit/${token}`));
      expect(await readJson(hostView)).toMatchObject({
        viewerIsParticipant: false,
        viewerParticipantStatus: null,
      });

      const joinerView = await joiner.app.fetch(req("GET", `/tournaments/submit/${token}`));
      expect(await readJson(joinerView)).toMatchObject({
        viewerIsParticipant: true,
        viewerParticipantStatus: "requested",
      });
    });

    it("rejects request-to-join once the tournament is completed or cancelled", async () => {
      const create = await host.app.fetch(
        req("POST", "/tournaments", {
          name: "Closed Event",
          host: { type: "user" },
          pairingStyle: "none",
          deckSubmission: "optional",
          startsAt: "2026-06-01T12:00:00Z",
          selfRegistration: true,
        }),
      );
      const closedId = ((await readJson(create)) as { id: string }).id;
      const enabled = await host.app.fetch(
        req("POST", `/tournaments/${closedId}/submission-token`),
      );
      const closedToken = ((await readJson(enabled)) as { submissionToken: string })
        .submissionToken;

      await host.app.fetch(req("PATCH", `/tournaments/${closedId}`, { status: "completed" }));
      const afterComplete = await joiner.app.fetch(
        req("POST", `/tournaments/submit/${closedToken}/request`),
      );
      expect(afterComplete.status).toBe(409);

      await host.app.fetch(req("PATCH", `/tournaments/${closedId}`, { status: "cancelled" }));
      const afterCancel = await joiner.app.fetch(
        req("POST", `/tournaments/submit/${closedToken}/request`),
      );
      expect(afterCancel.status).toBe(409);
    });

    it("rejects a request-to-join that waited for a cancellation", async () => {
      const create = await host.app.fetch(
        req("POST", "/tournaments", {
          name: "Summoner Skirmish Join Race",
          host: { type: "user" },
          pairingStyle: "none",
          deckSubmission: "optional",
          startsAt: "2026-06-01T12:00:00Z",
          selfRegistration: true,
        }),
      );
      const raceId = ((await readJson(create)) as { id: string }).id;
      const enabled = await host.app.fetch(req("POST", `/tournaments/${raceId}/submission-token`));
      const raceToken = ((await readJson(enabled)) as { submissionToken: string }).submissionToken;

      const canceller = await holdRow(
        host.db,
        sql`WITH locked AS (
          SELECT pg_advisory_xact_lock(hashtext(${`tournament-writes:${raceId}`}))
        ), written AS (
          UPDATE tournaments SET status = 'cancelled' WHERE id = ${raceId} RETURNING id
        ) SELECT 1 FROM locked, written`,
      );
      let joined: Promise<Response> | Response | undefined;
      try {
        joined = joiner.app.fetch(req("POST", `/tournaments/submit/${raceToken}/request`));
        await waitUntilBlockedBy(host.db, canceller.pid);
      } finally {
        await canceller.release();
      }
      const joinedRes = await joined;
      expect(joinedRes?.status).toBe(409);
      const spots = await host.db
        .selectFrom("tournamentParticipants")
        .select("id")
        .where("tournamentId", "=", raceId)
        .execute();
      expect(spots).toEqual([]);
    });

    it("rejects request-to-join when self-registration is closed", async () => {
      await host.app.fetch(req("PATCH", `/tournaments/${id}`, { selfRegistration: false }));
      const res = await joiner.app.fetch(req("POST", `/tournaments/submit/${token}/request`));
      expect(res.status).toBe(403);
    });

    it("grants staff via the invite link only on the explicit claim", async () => {
      const enabled = await host.app.fetch(
        req("POST", `/tournaments/${id}/staff-invite`, { role: "judge" }),
      );
      const inviteToken = ((await readJson(enabled)) as { judgeInviteToken: string })
        .judgeInviteToken;

      const anonLanding = await anon.app.fetch(
        req("GET", `/tournaments/staff-invite/${inviteToken}`),
      );
      expect(anonLanding.status).toBe(200);
      expect(
        (await readJson(anonLanding)) as { role: string; alreadyStaff: boolean },
      ).toMatchObject({ role: "judge", alreadyStaff: false });

      const landing = await joiner.app.fetch(
        req("GET", `/tournaments/staff-invite/${inviteToken}`),
      );
      expect(landing.status).toBe(200);
      const landingBody = (await readJson(landing)) as { role: string; alreadyStaff: boolean };
      expect(landingBody.role).toBe("judge");
      expect(landingBody.alreadyStaff).toBe(false);

      const beforeClaim = await host.app.fetch(req("GET", `/tournaments/${id}/staff`));
      const beforeItems = ((await readJson(beforeClaim)) as { items: { userId: string }[] }).items;
      expect(beforeItems.some((member) => member.userId === JOINER_ID)).toBe(false);

      const claim = await joiner.app.fetch(
        req("POST", `/tournaments/staff-invite/${inviteToken}/claim`),
      );
      expect(claim.status).toBe(200);
      expect((await readJson(claim)) as { role: string }).toMatchObject({ role: "judge" });

      const afterClaim = await host.app.fetch(req("GET", `/tournaments/${id}/staff`));
      const afterItems = (
        (await readJson(afterClaim)) as {
          items: { userId: string; role: string }[];
        }
      ).items;
      expect(
        afterItems.some((member) => member.userId === JOINER_ID && member.role === "judge"),
      ).toBe(true);

      const reclaim = await joiner.app.fetch(
        req("POST", `/tournaments/staff-invite/${inviteToken}/claim`),
      );
      expect(reclaim.status).toBe(200);
      expect((await readJson(reclaim)) as { alreadyStaff: boolean }).toMatchObject({
        alreadyStaff: true,
      });

      const missing = await joiner.app.fetch(req("GET", "/tournaments/staff-invite/nope"));
      expect(missing.status).toBe(404);
    });
  },
);
