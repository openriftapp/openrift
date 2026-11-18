import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { SeededPrinting } from "../../../test/catalog-seed.js";
import { seedCatalogPrinting } from "../../../test/catalog-seed.js";
import { createDbContext, seedTestUser } from "../../../test/integration-context.js";
import { catalogMutationsRepo } from "./catalog-mutations.js";

const ctx = createDbContext(crypto.randomUUID());

describe.skipIf(!ctx)("catalogMutationsRepo.detachDecksBeforeCatalogDeletion (integration)", () => {
  const { db } = ctx!;
  const repo = catalogMutationsRepo(db);
  let userId = "";
  let doomed: SeededPrinting;
  let kept: SeededPrinting;

  beforeAll(async () => {
    ({ id: userId } = await seedTestUser(db));
    doomed = await seedCatalogPrinting(db, "cmi");
    kept = await seedCatalogPrinting(db, "cmi");
  });

  afterAll(async () => {
    await db.deleteFrom("decks").where("userId", "=", userId).execute();
    await doomed.cleanup();
    await kept.cleanup();
    await db.deleteFrom("users").where("id", "=", userId).execute();
  });

  async function deckWithCover(cover: { coverFaceId?: string; coverCardId?: string }) {
    const deck = await db
      .insertInto("decks")
      .values({ userId, name: "Bandle Tempo", format: "constructed", ...cover })
      .returning("id")
      .executeTakeFirstOrThrow();
    return deck.id;
  }

  async function coverOf(deckId: string) {
    return db
      .selectFrom("decks")
      .select(["coverFaceId", "coverCardId"])
      .where("id", "=", deckId)
      .executeTakeFirstOrThrow();
  }

  it("clears a cover face on the printings and leaves the card cover when no card goes", async () => {
    const deckId = await deckWithCover({
      coverFaceId: doomed.faceId,
      coverCardId: doomed.cardId,
    });

    await repo.detachDecksBeforeCatalogDeletion([doomed.printingId]);

    expect(await coverOf(deckId)).toEqual({ coverFaceId: null, coverCardId: doomed.cardId });
  });

  it("clears the card's covers in the same write and leaves other cards' covers", async () => {
    const faceAndCard = await deckWithCover({
      coverFaceId: doomed.faceId,
      coverCardId: doomed.cardId,
    });
    const cardOnly = await deckWithCover({ coverCardId: doomed.cardId });
    const otherCard = await deckWithCover({ coverCardId: kept.cardId });

    await repo.detachDecksBeforeCatalogDeletion([doomed.printingId], doomed.cardId);

    expect(await coverOf(faceAndCard)).toEqual({ coverFaceId: null, coverCardId: null });
    expect(await coverOf(cardOnly)).toEqual({ coverFaceId: null, coverCardId: null });
    expect(await coverOf(otherCard)).toEqual({ coverFaceId: null, coverCardId: kept.cardId });
  });
});

describe.skipIf(!ctx)("catalogMutationsRepo.getSetIdBySlug (integration)", () => {
  const { db } = ctx!;
  const repo = catalogMutationsRepo(db);
  const suffix = crypto.randomUUID().slice(0, 8);
  const slugs = [`cmi-set-a-${suffix}`, `cmi-set-b-${suffix}`];
  let setIds: string[] = [];

  beforeAll(async () => {
    const rows = await db
      .insertInto("sets")
      .values(slugs.map((slug) => ({ slug, name: `Set ${slug}`, printedTotal: 1 })))
      .returning(["id", "slug"])
      .execute();
    setIds = slugs.map((slug) => rows.find((row) => row.slug === slug)!.id);
  });

  afterAll(async () => {
    await db.deleteFrom("sets").where("slug", "in", slugs).execute();
  });

  it("resolves each slug to its own set and an unknown slug to undefined", async () => {
    expect(await repo.getSetIdBySlug(slugs[0]!)).toEqual({ id: setIds[0] });
    expect(await repo.getSetIdBySlug(slugs[1]!)).toEqual({ id: setIds[1] });
    expect(await repo.getSetIdBySlug(`cmi-set-missing-${suffix}`)).toBeUndefined();
  });
});
