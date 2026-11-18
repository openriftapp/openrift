import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { SeededPrinting } from "../../../test/catalog-seed.js";
import { seedCatalogPrinting } from "../../../test/catalog-seed.js";
import { createDbContext } from "../../../test/integration-context.js";
import { printingEventsRepo } from "./printing-events.js";

const ctx = createDbContext(crypto.randomUUID());

describe.skipIf(!ctx)("printingEventsRepo (integration)", () => {
  const { db } = ctx!;
  const repo = printingEventsRepo(db);
  let seed: SeededPrinting;

  beforeAll(async () => {
    seed = await seedCatalogPrinting(db, "pev");
  });

  afterAll(async () => {
    if (seed) {
      await db.deleteFrom("printingEvents").where("printingId", "=", seed.printingId).execute();
      await seed.cleanup();
    }
  });

  async function insertEvent(
    status: "pending" | "sent" | "failed",
    retryCount = 0,
    createdAt = new Date(),
  ): Promise<string> {
    const row = await db
      .insertInto("printingEvents")
      .values({ printingId: seed.printingId, status, retryCount, createdAt })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  }

  function eventState(id: string) {
    return db
      .selectFrom("printingEvents")
      .select(["status", "retryCount"])
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
  }

  it("listByStatus returns the requested statuses newest first with the printing's card and set", async () => {
    const older = await insertEvent("failed", 5, new Date("2026-01-01T00:00:00Z"));
    const newer = await insertEvent("pending", 0, new Date("2026-01-02T00:00:00Z"));
    await insertEvent("sent", 0, new Date("2026-01-03T00:00:00Z"));

    const listed = await repo.listByStatus(["pending", "failed"]);
    const rows = listed.filter((row) => row.printingId === seed.printingId);

    expect(rows.map((row) => row.id)).toEqual([newer, older]);
    expect(rows[1]).toMatchObject({
      status: "failed",
      retryCount: 5,
      cardName: `Card ${seed.cardSlug}`,
      cardSlug: seed.cardSlug,
      setName: `Set ${seed.cardSlug}`,
      shortCode: `${seed.cardSlug}-001`,
      language: "EN",
    });
  });

  it("retryFailed resets only the given events to pending with no retries", async () => {
    const retried = await insertEvent("failed", 5);
    const untouched = await insertEvent("failed", 5);

    await repo.retryFailed([retried]);

    expect(await eventState(retried)).toEqual({ status: "pending", retryCount: 0 });
    expect(await eventState(untouched)).toEqual({ status: "failed", retryCount: 5 });
  });

  it.each([
    { from: 3, expected: { status: "pending", retryCount: 4 } },
    { from: 4, expected: { status: "failed", retryCount: 5 } },
  ])(
    "markRetry counts a retry from $from and fails the event at the cap",
    async ({ from, expected }) => {
      const event = await insertEvent("pending", from);
      const bystander = await insertEvent("pending", from);

      await repo.markRetry([event]);

      expect(await eventState(event)).toEqual(expected);
      expect(await eventState(bystander)).toEqual({ status: "pending", retryCount: from });
    },
  );
});
