import { afterAll, describe, expect, it } from "vitest";

import { adminReq, createTestContext } from "../../../test/integration-context.js";
import { readJson } from "../../../test/read-json.js";

const ADMIN_ID = "a0000000-0045-4000-a000-000000000001";
const NON_ADMIN_ID = "a0000000-0049-4000-a000-000000000001";

const adminCtx = createTestContext(ADMIN_ID);
const nonAdminCtx = createTestContext(NON_ADMIN_ID);

// These sort after every real version, so saving them never re-types real versions.
const CORE_VERSION = "ar-int-core";
const TOURNAMENT_VERSION = "ar-int-tournament";

const SAMPLE_CONTENT = ["100. # Setup", "100.1. Players begin with seven cards in hand."].join(
  "\n",
);

describe.skipIf(!adminCtx)("Admin rules routes (integration)", () => {
  // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by skipIf
  const { app, db } = adminCtx!;
  // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by skipIf
  const { app: nonAdminApp } = nonAdminCtx!;

  afterAll(async () => {
    await db
      .deleteFrom("ruleVersions")
      .where("version", "in", [CORE_VERSION, TOURNAMENT_VERSION])
      .execute();
  });

  describe("admin-only access control", () => {
    it("PUT /admin/rules/{kind}/{language}/versions/{version} returns 403 for non-admin", async () => {
      const res = await nonAdminApp.fetch(
        adminReq("PUT", "/rules/core/en/versions/ar-int-forbidden", { content: SAMPLE_CONTENT }),
      );
      expect(res.status).toBe(403);
    });
  });

  describe("PUT /admin/rules/{kind}/{language}/versions/{version}", () => {
    it("creates a core ruleset", async () => {
      const res = await app.fetch(
        adminReq("PUT", `/rules/core/en/versions/${CORE_VERSION}`, { content: SAMPLE_CONTENT }),
      );
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json).toMatchObject({
        kind: "core",
        language: "en",
        version: CORE_VERSION,
        status: "created",
        rulesCount: 2,
      });
    });

    it("creates a tournament ruleset under the same version string without collision", async () => {
      const res = await app.fetch(
        adminReq("PUT", `/rules/tournament/en/versions/${CORE_VERSION}`, {
          content: SAMPLE_CONTENT,
        }),
      );
      expect(res.status).toBe(200);
      expect(await readJson(res)).toMatchObject({ kind: "tournament", status: "created" });
    });

    it("reports identical rules as unchanged and replaces changed ones", async () => {
      const same = await app.fetch(
        adminReq("PUT", `/rules/core/en/versions/${CORE_VERSION}`, { content: SAMPLE_CONTENT }),
      );
      expect(await readJson(same)).toMatchObject({ status: "unchanged" });

      const changed = await app.fetch(
        adminReq("PUT", `/rules/core/en/versions/${CORE_VERSION}`, {
          content: `${SAMPLE_CONTENT}\n100.2. Players draw one card each turn.`,
        }),
      );
      expect(await readJson(changed)).toMatchObject({ status: "updated", rulesCount: 3 });

      const rows = await db
        .selectFrom("rules")
        .select("ruleNumber")
        .where("kind", "=", "core")
        .where("language", "=", "en")
        .where("version", "=", CORE_VERSION)
        .orderBy("sortOrder")
        .execute();
      expect(rows.map((row) => row.ruleNumber)).toEqual(["100", "100.1", "100.2"]);
    });

    it("rejects an invalid kind", async () => {
      const res = await app.fetch(
        adminReq("PUT", "/rules/bogus/en/versions/ar-int-bogus", { content: SAMPLE_CONTENT }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /admin/rules/{kind}/{language}/versions/{version}", () => {
    it("deletes only the specified kind", async () => {
      await app.fetch(
        adminReq("PUT", `/rules/tournament/en/versions/${TOURNAMENT_VERSION}`, {
          content: SAMPLE_CONTENT,
        }),
      );

      const res = await app.fetch(
        adminReq("DELETE", `/rules/tournament/en/versions/${TOURNAMENT_VERSION}`),
      );
      expect(res.status).toBe(204);

      const corePresent = await db
        .selectFrom("ruleVersions")
        .selectAll()
        .where("kind", "=", "core")
        .where("version", "=", CORE_VERSION)
        .executeTakeFirst();
      expect(corePresent).toBeDefined();
    });

    it("returns 404 when (kind, version) doesn't exist", async () => {
      const res = await app.fetch(
        adminReq("DELETE", "/rules/core/en/versions/ar-int-does-not-exist"),
      );
      expect(res.status).toBe(404);
    });
  });
});
