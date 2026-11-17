import { sleep } from "@openrift/shared/async";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTransact } from "../../../deps.js";
import type { Io } from "../../../io.js";
import {
  createDbContext,
  deletePrintingsByFace,
  deletePrintingsById,
  insertCards,
  insertPrintings,
  seedTestUser,
} from "../../../test/integration-context.js";
import { holdRow, waitUntilBlockedBy } from "../../../test/row-locks.js";
import { catalogDeleteGuardsRepo } from "../repositories/catalog-delete-guards.js";
import { catalogMutationsRepo } from "../repositories/catalog-mutations.js";
import { deletePrinting, insertNewPrinting, updatePrintingMarkers } from "./printing-admin.js";

// Editing one sibling printing's markers must not trip the
// `uq_printings_identity` constraint even when another printing already has
// the empty `marker_slugs = {}` state that the DELETE phase passes through.
// Relies on deferrable uniqueness constraints and `updatePrintingMarkers`
// running DELETE + INSERT inside one transaction.

const USER_ID = "a0000000-0042-4000-a000-000000000001";
const ctx = createDbContext(USER_ID);

describe.skipIf(!ctx)("updatePrintingMarkers (integration)", () => {
  const { db } = ctx!;
  const transact = createTransact(db);

  const SET_SLUG = "PADM-TEST";
  const CARD_SLUG = "PADM-001";
  const SHORT_CODE = "PADM-001";

  let setId = "";
  let cardId = "";
  let printingEmptyId = "";
  let printingWithMarkerId = "";

  beforeAll(async () => {
    // The test transitions markers [promo] → [nexus, promo] to force the join
    // table through an empty state. `promo` is globally seeded; `nexus` is not,
    // so seed it here for this test to reference.
    await db
      .insertInto("markers")
      .values({ slug: "nexus", label: "Nexus", description: null, sortOrder: 100 })
      .onConflict((oc) => oc.column("slug").doNothing())
      .execute();

    const [setRow] = await db
      .insertInto("sets")
      .values({
        slug: SET_SLUG,
        name: "Printing Admin Test Set",
        printedTotal: 1,
        sortOrder: 951,
      })
      .returning("id")
      .execute();
    setId = setRow!.id;

    const [cardRow] = await insertCards(db, {
      slug: CARD_SLUG,
      name: "Printing Admin Test Card",
      types: ["unit"],
      might: null,
      energy: 1,
      power: null,
      mightBonus: null,
      keywords: [],
      tags: [],
    });
    cardId = cardRow!.id;

    await db
      .insertInto("cardDomains")
      .values({ cardId, domainSlug: "fury", sortOrder: 0 })
      .execute();

    // Printing A: empty marker_slugs (the sibling that causes the collision).
    const [emptyRow] = await insertPrintings(db, {
      cardId,
      setId,
      shortCode: SHORT_CODE,
      rarity: "common",
      artVariant: "normal",
      isSigned: false,
      finish: "foil",
      artist: "Test",
      publicCode: SHORT_CODE,
      language: "EN",
      size: "standard",
    });
    printingEmptyId = emptyRow!.id;

    // Printing B: same identity columns as A but distinguished by a marker.
    // Insert with default empty markers first, then attach a marker row —
    // the sync trigger repopulates marker_slugs to ['promo'], making B
    // distinct from A under `uq_printings_identity`.
    const [markerRow] = await insertPrintings(db, {
      cardId,
      setId,
      shortCode: SHORT_CODE,
      rarity: "common",
      artVariant: "normal",
      isSigned: false,
      finish: "foil",
      artist: "Test",
      publicCode: SHORT_CODE,
      language: "EN",
      // Set directly; no sibling row with ['promo'] exists yet so no clash.
      markerSlugs: ["promo"],
      size: "standard",
    });
    printingWithMarkerId = markerRow!.id;

    const promoMarker = await db
      .selectFrom("markers")
      .select(["id", "slug"])
      .where("slug", "=", "promo")
      .executeTakeFirstOrThrow();
    await db
      .updateTable("faces")
      .set({ markerSlugs: [promoMarker.slug] })
      .where("id", "=", printingWithMarkerId)
      .execute();
  });

  afterAll(async () => {
    await deletePrintingsById(db, [printingEmptyId, printingWithMarkerId]);
    await db.deleteFrom("cards").where("id", "=", cardId).execute();
    await db.deleteFrom("sets").where("id", "=", setId).execute();
  });

  it("replaces markers even when a sibling printing has empty marker_slugs", async () => {
    // Transitioning from [promo] to [nexus, promo] forces the join table
    // through an empty state inside the transaction. Without deferrable
    // `uq_printings_identity`, the per-statement check sees the intermediate
    // `marker_slugs = {}` and collides with the empty-marker sibling.
    await expect(
      updatePrintingMarkers(transact, printingWithMarkerId, ["nexus", "promo"]),
    ).resolves.toBeUndefined();

    const updated = await db
      .selectFrom("faces")
      .select("markerSlugs")
      .where("id", "=", printingWithMarkerId)
      .executeTakeFirstOrThrow();
    expect(updated.markerSlugs).toEqual(["nexus", "promo"]);

    const untouched = await db
      .selectFrom("faces")
      .select("markerSlugs")
      .where("id", "=", printingEmptyId)
      .executeTakeFirstOrThrow();
    expect(untouched.markerSlugs).toEqual([]);
  });
});

describe.skipIf(!ctx)("insertNewPrinting (integration)", () => {
  const { db } = ctx!;
  const transact = createTransact(db);

  const SET_SLUG = "PADM2-TEST";
  const CARD_SLUG = "PADM2-001";
  const SHORT_CODE = "PADM2-001";

  const fields = {
    shortCode: SHORT_CODE,
    setId: SET_SLUG,
    setName: "Printing Admin Require-New Set",
    rarity: "common",
    artist: "Original Artist",
    publicCode: SHORT_CODE,
  };

  let setId = "";
  let cardId = "";
  let printingId = "";

  beforeAll(async () => {
    const [setRow] = await db
      .insertInto("sets")
      .values({
        slug: SET_SLUG,
        name: "Printing Admin Require-New Set",
        printedTotal: 1,
        sortOrder: 952,
      })
      .returning("id")
      .execute();
    setId = setRow!.id;

    const [cardRow] = await insertCards(db, {
      slug: CARD_SLUG,
      name: "Printing Admin Require-New Card",
      types: ["unit"],
      might: null,
      energy: 1,
      power: null,
      mightBonus: null,
      keywords: [],
      tags: [],
    });
    cardId = cardRow!.id;

    await db
      .insertInto("cardDomains")
      .values({ cardId, domainSlug: "fury", sortOrder: 0 })
      .execute();

    const [printingRow] = await insertPrintings(db, {
      cardId,
      setId,
      shortCode: SHORT_CODE,
      rarity: "common",
      artVariant: "normal",
      isSigned: false,
      finish: "normal",
      artist: "Original Artist",
      publicCode: `${SHORT_CODE}/1`,
      language: "EN",
      size: "standard",
    });
    printingId = printingRow!.id;
  });

  afterAll(async () => {
    await deletePrintingsByFace(db, "cardId", "=", cardId);
    await db.deleteFrom("cards").where("id", "=", cardId).execute();
    await db.deleteFrom("sets").where("id", "=", setId).execute();
  });

  it("rejects a duplicate of an existing printing instead of overwriting it", async () => {
    await expect(
      transact((trx) =>
        insertNewPrinting(trx, cardId, { ...fields, artist: "Overwriting Artist" }, []),
      ),
    ).rejects.toThrow(`This card already has a printing with short code "${SHORT_CODE}"`);

    const unchanged = await db
      .selectFrom("faces")
      .select("artist")
      .where("id", "=", printingId)
      .executeTakeFirstOrThrow();
    expect(unchanged.artist).toBe("Original Artist");
  });

  it("allows a duplicate that differs in a field the identity covers", async () => {
    const { printingId: newId } = await transact((trx) =>
      insertNewPrinting(trx, cardId, { ...fields, finish: "foil" }, []),
    );

    expect(newId).not.toBe(printingId);
    const created = await db
      .selectFrom("faces")
      .select("finish")
      .where("id", "=", (eb) =>
        eb.selectFrom("printings").select("face1Id").where("id", "=", newId),
      )
      .executeTakeFirstOrThrow();
    expect(created.finish).toBe("foil");
  });

  it("refuses another size whose printed fields differ from the shared face", async () => {
    await expect(
      transact((trx) =>
        insertNewPrinting(
          trx,
          cardId,
          { ...fields, size: "oversized", artist: "Other Artist" },
          [],
        ),
      ),
    ).rejects.toThrow(`The existing ${SHORT_CODE} normal EN face differs in artist.`);

    const unchanged = await db
      .selectFrom("faces")
      .select("artist")
      .where("id", "=", printingId)
      .executeTakeFirstOrThrow();
    expect(unchanged.artist).toBe("Original Artist");
  });

  it("shares the existing face for another size with matching printed fields", async () => {
    const { printingId: oversizedId } = await transact((trx) =>
      insertNewPrinting(trx, cardId, { ...fields, size: "oversized" }, []),
    );

    const oversized = await db
      .selectFrom("printings")
      .select("face1Id")
      .where("id", "=", oversizedId)
      .executeTakeFirstOrThrow();
    expect(oversized.face1Id).toBe(printingId);
    const face = await db
      .selectFrom("faces")
      .select("artist")
      .where("id", "=", printingId)
      .executeTakeFirstOrThrow();
    expect(face.artist).toBe("Original Artist");
  });
});

describe.skipIf(!ctx)("deletePrinting lock order (integration)", () => {
  const { db } = ctx!;
  const transact = createTransact(db);
  const repos = {
    catalogMutations: catalogMutationsRepo(db),
    catalogDeleteGuards: catalogDeleteGuardsRepo(db),
  };
  const ownerId = crypto.randomUUID();

  let setId = "";
  let cardId = "";
  let printingId = "";
  let deckId = "";

  beforeAll(async () => {
    await seedTestUser(db, { id: ownerId });
    const [setRow] = await db
      .insertInto("sets")
      .values({
        slug: "PADM3-TEST",
        name: "Printing Admin Lock Set",
        printedTotal: 1,
        sortOrder: 953,
      })
      .returning("id")
      .execute();
    setId = setRow!.id;

    const [cardRow] = await insertCards(db, {
      slug: "PADM3-001",
      name: "Printing Admin Lock Card",
      types: ["unit"],
      might: null,
      energy: 1,
      power: null,
      mightBonus: null,
      keywords: [],
      tags: [],
    });
    cardId = cardRow!.id;
    await db
      .insertInto("cardDomains")
      .values({ cardId, domainSlug: "fury", sortOrder: 0 })
      .execute();

    const [printingRow] = await insertPrintings(db, {
      cardId,
      setId,
      shortCode: "PADM3-001",
      rarity: "common",
      artVariant: "normal",
      isSigned: false,
      finish: "normal",
      artist: "Test",
      publicCode: "PADM3-001/1",
      language: "EN",
      size: "standard",
    });
    printingId = printingRow!.id;

    const [deck] = await db
      .insertInto("decks")
      .values({ userId: ownerId, name: "Printing Admin Lock Deck", format: "constructed" } as never)
      .returning("id")
      .execute();
    deckId = deck!.id;
    await db
      .insertInto("deckCards")
      .values([
        { deckId, cardId, zone: "main", quantity: 1, preferredPrintingId: printingId },
        { deckId, cardId, zone: "main", quantity: 2, preferredPrintingId: null },
      ])
      .execute();
  });

  afterAll(async () => {
    await db.deleteFrom("decks").where("userId", "=", ownerId).execute();
    await db.deleteFrom("collections").where("userId", "=", ownerId).execute();
    await db.deleteFrom("users").where("id", "=", ownerId).execute();
    await deletePrintingsByFace(db, "cardId", "=", cardId);
    await db.deleteFrom("cards").where("id", "=", cardId).execute();
    await db.deleteFrom("sets").where("id", "=", setId).execute();
  });

  it("takes the deck showing the printing before the printing itself", async () => {
    const deck = await holdRow(db, sql`SELECT 1 FROM decks WHERE id = ${deckId} FOR UPDATE`);
    let pending: Promise<void> | undefined;
    try {
      pending = deletePrinting(transact, {} as Io, repos, printingId);
      await waitUntilBlockedBy(db, deck.pid);
      const lockable = await db.transaction().execute(async (trx) => {
        const { rows } = await sql<{ id: string }>`
          SELECT id FROM printings WHERE id = ${printingId} FOR UPDATE SKIP LOCKED
        `.execute(trx);
        return rows;
      });
      expect(lockable).toEqual([{ id: printingId }]);
    } finally {
      await deck.release();
    }
    await pending;

    const slots = await db
      .selectFrom("deckCards")
      .select(["preferredPrintingId", "quantity"])
      .where("deckId", "=", deckId)
      .execute();
    expect(slots).toEqual([{ preferredPrintingId: null, quantity: 3 }]);
    const printing = await db
      .selectFrom("printings")
      .select("id")
      .where("id", "=", printingId)
      .executeTakeFirst();
    expect(printing).toBeUndefined();
  });

  it("finishes while a collection deletion holds the deck's collection", async () => {
    const [coverPrinting] = await insertPrintings(db, {
      cardId,
      setId,
      shortCode: "PADM3-002",
      rarity: "common",
      artVariant: "normal",
      isSigned: false,
      finish: "normal",
      artist: "Test",
      publicCode: "PADM3-002/1",
      language: "EN",
      size: "standard",
    });
    const coverPrintingId = coverPrinting!.id;
    const { face1Id } = await db
      .selectFrom("printings")
      .select("face1Id")
      .where("id", "=", coverPrintingId)
      .executeTakeFirstOrThrow();
    const [collection] = await db
      .insertInto("collections")
      .values({
        userId: ownerId,
        groupId: null,
        name: "Printing Admin Lock Collection",
        description: null,
        isInbox: false,
        sortOrder: 0,
      })
      .returning("id")
      .execute();
    const collectionId = collection!.id;
    const [boxed] = await db
      .insertInto("decks")
      .values({
        userId: ownerId,
        name: "Printing Admin Boxed Deck",
        format: "constructed",
        collectionId,
        coverFaceId: face1Id,
        coverCardId: cardId,
      } as never)
      .returning("id")
      .execute();
    const boxedId = boxed!.id;
    await db
      .insertInto("deckCards")
      .values({
        deckId: boxedId,
        cardId,
        zone: "main",
        quantity: 1,
        preferredPrintingId: coverPrintingId,
      })
      .execute();

    const held = await holdRow(
      db,
      sql`SELECT 1 FROM collections WHERE id = ${collectionId} FOR UPDATE`,
    );
    const pending = deletePrinting(transact, {} as Io, repos, coverPrintingId).then(
      () => "deleted" as const,
    );
    try {
      expect(await Promise.race([pending, sleep(3000).then(() => "blocked" as const)])).toBe(
        "deleted",
      );
    } finally {
      await held.release();
      await pending.catch(() => null);
    }

    const deck = await db
      .selectFrom("decks")
      .select(["coverFaceId", "coverCardId", "collectionId"])
      .where("id", "=", boxedId)
      .executeTakeFirstOrThrow();
    expect(deck).toEqual({ coverFaceId: null, coverCardId: cardId, collectionId });
    const slots = await db
      .selectFrom("deckCards")
      .select(["preferredPrintingId", "quantity"])
      .where("deckId", "=", boxedId)
      .execute();
    expect(slots).toEqual([{ preferredPrintingId: null, quantity: 1 }]);
  });
});
