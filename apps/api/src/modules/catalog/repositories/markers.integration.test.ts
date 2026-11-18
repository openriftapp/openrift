import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { SeededPrinting } from "../../../test/catalog-seed.js";
import { seedCatalogPrinting } from "../../../test/catalog-seed.js";
import { createDbContext } from "../../../test/integration-context.js";
import { markersRepo } from "./markers.js";

const ctx = createDbContext(crypto.randomUUID());

describe.skipIf(!ctx)("markersRepo.setForPrinting (integration)", () => {
  const { db } = ctx!;
  const repo = markersRepo(db);
  let seeded: SeededPrinting;
  let promoId = "";

  async function storedSlugs(): Promise<string[]> {
    const face = await db
      .selectFrom("faces")
      .select("markerSlugs")
      .where("id", "=", seeded.faceId)
      .executeTakeFirstOrThrow();
    return face.markerSlugs;
  }

  beforeAll(async () => {
    seeded = await seedCatalogPrinting(db, "mki");
    const promo = await db
      .selectFrom("markers")
      .select("id")
      .where("slug", "=", "promo")
      .executeTakeFirstOrThrow();
    promoId = promo.id;
  });

  afterAll(async () => {
    await seeded.cleanup();
  });

  it("writes the markers onto the printing's first face", async () => {
    await repo.setForPrinting(seeded.printingId, [promoId]);

    expect(await storedSlugs()).toEqual(["promo"]);
  });

  it("clears the face's markers when the new set is empty", async () => {
    await repo.setForPrinting(seeded.printingId, []);

    expect(await storedSlugs()).toEqual([]);
  });
});
