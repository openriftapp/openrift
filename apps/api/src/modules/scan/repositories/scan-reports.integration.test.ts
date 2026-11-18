import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbContext, seedTestUser } from "../../../test/integration-context.js";
import { scanReportsRepo } from "./scan-reports.js";

const ctx = createDbContext(crypto.randomUUID());

describe.skipIf(!ctx)("scanReportsRepo (integration)", () => {
  const { db } = ctx!;
  const repo = scanReportsRepo(db);
  let userId = "";

  beforeAll(async () => {
    ({ id: userId } = await seedTestUser(db));
  });

  afterAll(async () => {
    await db.deleteFrom("scanReports").where("userId", "=", userId).execute();
    await db.deleteFrom("users").where("id", "=", userId).execute();
  });

  it("insert writes the report with its journal entries intact", async () => {
    const reference = `SR-${crypto.randomUUID().slice(0, 8)}`;
    const journal = [
      { t: 0, type: "open" },
      { t: 1250, type: "match", cardSlug: "ogn-001", score: 0.91 },
    ];

    await repo.insert({
      userId,
      reference,
      note: "Missed the foil",
      userAgent: "test-agent",
      journal,
    });

    expect(
      await db
        .selectFrom("scanReports")
        .select(["userId", "reference", "note", "userAgent", "journal"])
        .where("reference", "=", reference)
        .execute(),
    ).toEqual([{ userId, reference, note: "Missed the foil", userAgent: "test-agent", journal }]);
  });
});
