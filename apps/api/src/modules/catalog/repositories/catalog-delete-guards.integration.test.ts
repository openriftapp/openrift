import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { SeededPrinting } from "../../../test/catalog-seed.js";
import { seedCatalogPrinting } from "../../../test/catalog-seed.js";
import { createDbContext, seedTestUser } from "../../../test/integration-context.js";
import { catalogDeleteGuardsRepo } from "./catalog-delete-guards.js";

const ctx = createDbContext(crypto.randomUUID());

describe.skipIf(!ctx)("catalogDeleteGuardsRepo.countForPrinting (integration)", () => {
  const { db } = ctx!;
  const repo = catalogDeleteGuardsRepo(db);
  let userId = "";
  let collectionId = "";
  let blocked: SeededPrinting;
  let free: SeededPrinting;

  beforeAll(async () => {
    ({ id: userId } = await seedTestUser(db));
    blocked = await seedCatalogPrinting(db, "cdg");
    free = await seedCatalogPrinting(db, "cdg");
    const collection = await db
      .insertInto("collections")
      .values({ userId, groupId: null, name: "Delete Guard Binder", isInbox: false })
      .returning("id")
      .executeTakeFirstOrThrow();
    collectionId = collection.id;
    await db
      .insertInto("copies")
      .values([
        { collectionId, printingId: blocked.printingId },
        { collectionId, printingId: blocked.printingId },
      ])
      .execute();
  });

  afterAll(async () => {
    await db.deleteFrom("copies").where("collectionId", "=", collectionId).execute();
    await db.deleteFrom("collections").where("id", "=", collectionId).execute();
    await blocked?.cleanup();
    await free?.cleanup();
    await db.deleteFrom("users").where("id", "=", userId).execute();
  });

  const noBlockers = {
    copies: 0,
    collectionEvents: 0,
    listEntries: 0,
    loans: 0,
    cardTrades: 0,
    marketplaceProductVariants: 0,
    productPrintings: 0,
  };

  it("counts the copies that reference the printing and nothing on another printing", async () => {
    expect(await repo.countForPrinting(blocked.printingId)).toEqual({ ...noBlockers, copies: 2 });
    expect(await repo.countForPrinting(free.printingId)).toEqual(noBlockers);
  });
});
