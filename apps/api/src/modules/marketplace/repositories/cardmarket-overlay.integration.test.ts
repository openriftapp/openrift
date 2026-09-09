import type { ListRule } from "@openrift/shared/types/list-rule";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { EMPTY_CARD_FILTERS } from "@openrift/shared/types/search";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRepos } from "../../../deps.js";
import { CARD_FURY_RUNE, PRINTINGS, PRINTING_2 } from "../../../test/fixtures/constants.js";
import { createDbContext } from "../../../test/integration-context.js";
import { overlayWantsFromEntries } from "../lib/cardmarket-overlay-wants.js";
import { cardmarketOverlayRepo } from "./cardmarket-overlay.js";

const ctx = createDbContext("a0000000-0032-4000-a000-000000000001");

describe.skipIf(!ctx)("cardmarketOverlayRepo (integration)", () => {
  const { db, userId } = ctx!;
  const repo = cardmarketOverlayRepo(db);
  // The route resolves wants through the lists repo, which needs the rule providers.
  const repos = createRepos(db);

  // This file's own 914_2xx externalId range keys every assertion and the cleanup.
  const groupId = 80_202;
  const sharedExternalId = 914_201;
  const absentExternalId = 914_203;
  const tcgOnlyExternalId = 914_216;
  const scOnlyExternalId = 914_205;
  const unpricedExternalId = 914_206;
  const priceOnlyExternalId = 914_207;

  const runeEn = PRINTINGS["OGN-007:common:normal::EN"];
  const runeSc = PRINTINGS["OGN-007:common:normal::SC"];
  const runeFoilEn = PRINTINGS["OGN-007a:showcase:foil::EN"];
  const runeFoilSc = PRINTINGS["OGN-007a:showcase:foil::SC"];
  // No seed row maps either printing to any product, so nothing prices them.
  const unmappedPrinting = PRINTINGS["OGS-017:rare:metal-deluxe:promo:EN"];
  const absentPrinting = PRINTINGS["OGS-019:rare:metal-deluxe:promo:EN"];

  // Dated past every seeded price so this file's day is the latest for each of
  // these printings, whatever the seed recorded on its own days.
  const PRICED_AT = new Date("2126-04-01T00:00:00Z");
  const EN_CENTS = 500;
  const SC_CENTS = 100;
  const FOIL_EN_CENTS = 800;
  const FOIL_SC_CENTS = 700;
  const OTHER_CARD_CENTS = 250;
  const TCG_EN_CENTS = 900;

  const createdProductIds: string[] = [];
  const createdCollectionIds: string[] = [];
  const createdCopyIds: string[] = [];
  const createdListIds: string[] = [];
  const createdFriendGroupIds: string[] = [];

  let listId: string;
  let secondListId: string;
  let tradeListId: string;
  let ruleListId: string;
  let foilCopyId: string;

  /** Mirrors what the route does: expand each list's rules, then flatten. */
  async function wantsFor(lists: { id: string; kind: "card" | "printing" }[]) {
    const perList = await Promise.all(
      lists.map((list) => repos.lists.entriesWithDetails(list.id, list.kind, userId)),
    );
    return perList.flatMap((entries) => overlayWantsFromEntries(entries));
  }

  function manual(id: string) {
    return wantsFor([{ id, kind: "printing" }]);
  }

  async function createProduct(
    externalId: number,
    finish: string,
    printingIds: string[],
    marketplace: Marketplace = "cardmarket",
  ) {
    const product = await db
      .insertInto("marketplaceProducts")
      .values({
        marketplace,
        groupId,
        externalId,
        productName: `Overlay Test ${externalId}`,
        finish,
        language: null,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    createdProductIds.push(product.id);
    await db
      .insertInto("marketplaceProductVariants")
      .values(printingIds.map((printingId) => ({ marketplaceProductId: product.id, printingId })))
      .execute();
    return product.id;
  }

  /**
   * A product covering exactly one printing, so its price is that printing's.
   * The Cardmarket headline reads `low_cents` (see mv_daily_printing_prices).
   */
  async function priceOnePrinting(
    externalId: number,
    printingId: string,
    lowCents: number,
    marketplace: Marketplace = "cardmarket",
  ) {
    const productId = await createProduct(externalId, "normal", [printingId], marketplace);
    await db
      .insertInto("marketplaceProductPrices")
      .values({
        marketplaceProductId: productId,
        marketCents: lowCents,
        lowCents,
        recordedAt: PRICED_AT,
      })
      .execute();
  }

  async function createList(
    name: string,
    intent: "wish" | "trade" | "organize",
    options: { kind?: "card" | "printing" | "copy"; rules?: ListRule[] } = {},
  ) {
    const list = await db
      .insertInto("lists")
      .values({
        userId,
        name,
        intent,
        kind: options.kind ?? (intent === "trade" ? "copy" : "printing"),
        rules: options.rules ?? [],
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    createdListIds.push(list.id);
    return list.id;
  }

  async function addCopy(collectionId: string, printingId: string) {
    const copy = await db
      .insertInto("copies")
      .values({ collectionId, printingId })
      .returning("id")
      .executeTakeFirstOrThrow();
    createdCopyIds.push(copy.id);
    return copy.id;
  }

  beforeAll(async () => {
    await db
      .insertInto("users")
      .values({
        id: userId,
        email: `test-${userId}@test.com`,
        name: "Overlay Test User",
        emailVerified: true,
        image: null,
      })
      .onConflict((oc) => oc.column("id").doNothing())
      .execute();

    await db
      .insertInto("marketplaceGroups")
      .values([
        { marketplace: "cardmarket", groupId, name: "CM Overlay Test", abbreviation: null },
        { marketplace: "tcgplayer", groupId, name: "TCG Overlay Test", abbreviation: null },
      ])
      .onConflict((oc) => oc.columns(["marketplace", "groupId"]).doNothing())
      .execute();

    await createProduct(sharedExternalId, "normal", [runeEn.id, runeSc.id]);
    await createProduct(sharedExternalId, "foil", [runeFoilEn.id, runeFoilSc.id]);
    await createProduct(absentExternalId, "normal", [absentPrinting.id]);
    await createProduct(scOnlyExternalId, "normal", [runeSc.id, runeFoilSc.id]);
    await createProduct(unpricedExternalId, "normal", [unmappedPrinting.id]);
    await createProduct(priceOnlyExternalId, "normal", [PRINTING_2.id]);

    await priceOnePrinting(914_211, runeEn.id, EN_CENTS);
    await priceOnePrinting(914_212, runeSc.id, SC_CENTS);
    await priceOnePrinting(914_213, runeFoilEn.id, FOIL_EN_CENTS);
    await priceOnePrinting(914_214, runeFoilSc.id, FOIL_SC_CENTS);
    await priceOnePrinting(914_215, PRINTING_2.id, OTHER_CARD_CENTS);
    await priceOnePrinting(914_216, runeEn.id, TCG_EN_CENTS, "tcgplayer");

    const collection = await db
      .insertInto("collections")
      .values({ userId, name: "Overlay Test Binder", isInbox: false, sortOrder: 1 })
      .returning("id")
      .executeTakeFirstOrThrow();
    createdCollectionIds.push(collection.id);

    await addCopy(collection.id, runeEn.id);
    await addCopy(collection.id, runeEn.id);
    await addCopy(collection.id, runeSc.id);
    foilCopyId = await addCopy(collection.id, runeFoilEn.id);
    // Puts the unpriced product in the result, so its null price is assertable.
    await addCopy(collection.id, unmappedPrinting.id);

    // A copy the user can see but does not own: it must not raise `owned`.
    const friendGroup = await db
      .insertInto("friendGroups")
      .values({ slug: `overlay-test-group-${groupId}`, name: "Overlay Test Group" })
      .returning("id")
      .executeTakeFirstOrThrow();
    createdFriendGroupIds.push(friendGroup.id);
    await db
      .insertInto("friendGroupMembers")
      .values({ groupId: friendGroup.id, userId, role: "member" })
      .execute();
    const groupCollection = await db
      .insertInto("collections")
      .values({
        groupId: friendGroup.id,
        name: "Overlay Group Binder",
        isInbox: false,
        sortOrder: 1,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    createdCollectionIds.push(groupCollection.id);
    await addCopy(groupCollection.id, runeEn.id);

    listId = await createList("Overlay Wants", "wish");
    secondListId = await createList("Overlay Extra Wants", "wish");
    tradeListId = await createList("Overlay Trades", "trade");
    // Rule-driven and entry-less: 6 wanted less the 4 Fury Rune copies owned
    // above leaves 2. Name-scoped so the filter cannot drag in another card.
    ruleListId = await createList("Overlay Playset", "wish", {
      kind: "card",
      rules: [
        {
          kind: "wish",
          filter: { ...EMPTY_CARD_FILTERS, search: "Fury Rune", searchScope: ["name"] },
          quantity: { mode: "fixed", n: 6 },
          excludeIds: [],
          netOwned: true,
        },
      ],
    });

    await db
      .insertInto("listEntries")
      .values([
        { listId, userId, kind: "card", cardId: runeEn.cardId, quantity: 2 },
        { listId, userId, kind: "printing", printingId: runeSc.id, quantity: 3 },
        { listId, userId, kind: "copy", copyId: foilCopyId, quantity: 1 },
        // A second list wanting the same card: the two lists' wants add up.
        { listId: secondListId, userId, kind: "printing", printingId: runeEn.id, quantity: 4 },
      ])
      .execute();

    await sql`REFRESH MATERIALIZED VIEW mv_daily_printing_prices`.execute(db);
    await sql`REFRESH MATERIALIZED VIEW mv_latest_printing_prices`.execute(db);
  });

  afterAll(async () => {
    await db.deleteFrom("lists").where("id", "in", createdListIds).execute();
    await db.deleteFrom("copies").where("id", "in", createdCopyIds).execute();
    await db.deleteFrom("collections").where("id", "in", createdCollectionIds).execute();
    await db
      .deleteFrom("friendGroupMembers")
      .where("groupId", "in", createdFriendGroupIds)
      .execute();
    await db.deleteFrom("friendGroups").where("id", "in", createdFriendGroupIds).execute();
    await db
      .deleteFrom("marketplaceProductVariants")
      .where("marketplaceProductId", "in", createdProductIds)
      .execute();
    // Prices cascade from the product delete; the variants above do not.
    await db.deleteFrom("marketplaceProducts").where("id", "in", createdProductIds).execute();
    await db
      .deleteFrom("marketplaceGroups")
      .where("marketplace", "in", ["cardmarket", "tcgplayer"])
      .where("groupId", "=", groupId)
      .execute();
    await db.deleteFrom("users").where("id", "=", userId).execute();
    // Or every later file reading the views would see this file's 2126 prices as latest.
    await sql`REFRESH MATERIALIZED VIEW mv_daily_printing_prices`.execute(db);
    await sql`REFRESH MATERIALIZED VIEW mv_latest_printing_prices`.execute(db);
  });

  function keyed(rows: Awaited<ReturnType<typeof repo.productCounts>>) {
    return new Map(rows.map((row) => [`${row.idProduct}:${row.finish}`, row]));
  }

  it("splits one product id into independent per-finish rows", async () => {
    const byProduct = keyed(await repo.productCounts(await manual(listId), userId, "cardmarket"));

    // owned: 2 EN + 1 SC normal copies. wanted: card entry 2 (once, not once
    // per mapped printing) + printing entry 3.
    expect(byProduct.get(`${sharedExternalId}:normal`)).toEqual({
      idProduct: sharedExternalId,
      finish: "normal",
      owned: 3,
      wanted: 5,
      priceCents: EN_CENTS,
    });
    // owned: the single foil EN copy. wanted: card entry 2 + copy entry 1.
    expect(byProduct.get(`${sharedExternalId}:foil`)).toEqual({
      idProduct: sharedExternalId,
      finish: "foil",
      owned: 1,
      wanted: 3,
      priceCents: FOIL_EN_CENTS,
    });
  });

  it("sums the wants of several lists on one product", async () => {
    const byProduct = keyed(
      await repo.productCounts(
        await wantsFor([
          { id: listId, kind: "printing" },
          { id: secondListId, kind: "printing" },
        ]),
        userId,
        "cardmarket",
      ),
    );

    // The first list's 5 plus the second list's printing entry of 4.
    expect(byProduct.get(`${sharedExternalId}:normal`)?.wanted).toBe(9);
    // The second list wants nothing in foil, so that row is unchanged.
    expect(byProduct.get(`${sharedExternalId}:foil`)?.wanted).toBe(3);
  });

  it("counts a rule-driven list that has no list_entries rows", async () => {
    const wants = await wantsFor([{ id: ruleListId, kind: "card" }]);
    // The rule expands to one card target, already netted against owned copies.
    expect(wants).toEqual([{ cardId: CARD_FURY_RUNE.id, printingId: null, quantity: 2 }]);

    const byProduct = keyed(await repo.productCounts(wants, userId, "cardmarket"));

    expect(byProduct.get(`${sharedExternalId}:normal`)?.wanted).toBe(2);
    expect(byProduct.get(`${sharedExternalId}:foil`)?.wanted).toBe(2);
  });

  it("sums a manual and a rule-driven list wanting the same card", async () => {
    const wants = await wantsFor([
      { id: listId, kind: "printing" },
      { id: ruleListId, kind: "card" },
    ]);

    const byProduct = keyed(await repo.productCounts(wants, userId, "cardmarket"));

    // The manual list's 5 plus the rule's 2.
    expect(byProduct.get(`${sharedExternalId}:normal`)?.wanted).toBe(7);
    // The manual list's 3 plus the rule's 2.
    expect(byProduct.get(`${sharedExternalId}:foil`)?.wanted).toBe(5);
  });

  // The route dedupes list ids; two identical wants mean two lists asking, and
  // those add. The DISTINCT below only stops one want counting per printing.
  it("adds two identical wants rather than collapsing them", async () => {
    const wants = await manual(listId);

    const once = keyed(await repo.productCounts(wants, userId, "cardmarket"));
    const twice = keyed(await repo.productCounts([...wants, ...wants], userId, "cardmarket"));

    expect(twice.get(`${sharedExternalId}:normal`)?.wanted).toBe(
      (once.get(`${sharedExternalId}:normal`)?.wanted ?? 0) * 2,
    );
  });

  // Filtered to this file's own range: the seed maps the same printings to its
  // own Cardmarket products, which legitimately show up in the full result.
  it("orders by product id then finish", async () => {
    const rows = await repo.productCounts(await manual(listId), userId, "cardmarket");

    expect(
      rows
        .filter((row) => row.idProduct === sharedExternalId)
        .map((row) => `${row.idProduct}:${row.finish}`),
    ).toEqual([`${sharedExternalId}:foil`, `${sharedExternalId}:normal`]);
  });

  it("omits a product that is neither owned, wanted nor priced", async () => {
    const rows = await repo.productCounts(await manual(listId), userId, "cardmarket");

    expect(rows.some((row) => row.idProduct === absentExternalId)).toBe(false);
  });

  it("emits a priced product the caller neither owns nor wants", async () => {
    const byProduct = keyed(await repo.productCounts(await manual(listId), userId, "cardmarket"));

    expect(byProduct.get(`${priceOnlyExternalId}:normal`)).toEqual({
      idProduct: priceOnlyExternalId,
      finish: "normal",
      owned: 0,
      wanted: 0,
      priceCents: OTHER_CARD_CENTS,
    });
  });

  it("falls back to the cheapest mapped printing when none of them is EN", async () => {
    const byProduct = keyed(await repo.productCounts(await manual(listId), userId, "cardmarket"));

    // Maps the SC normal (100) and the SC foil (700) printings, no EN at all.
    expect(byProduct.get(`${scOnlyExternalId}:normal`)?.priceCents).toBe(SC_CENTS);
  });

  it("reports a null price when no mapped printing is priced", async () => {
    const byProduct = keyed(await repo.productCounts(await manual(listId), userId, "cardmarket"));

    expect(byProduct.get(`${unpricedExternalId}:normal`)).toEqual({
      idProduct: unpricedExternalId,
      finish: "normal",
      owned: 1,
      wanted: 0,
      priceCents: null,
    });
  });

  it("prices against the requested marketplace", async () => {
    const byProduct = keyed(await repo.productCounts(await manual(listId), userId, "tcgplayer"));

    expect(byProduct.get(`${sharedExternalId}:normal`)?.priceCents).toBe(TCG_EN_CENTS);
    // Only the printing behind the row changes marketplace; the row set is Cardmarket's.
    expect(byProduct.has(`${tcgOnlyExternalId}:normal`)).toBe(false);
  });

  it("returns only owned counts for a list with no entries", async () => {
    const empty = await createList("Overlay Empty", "wish");

    const byProduct = keyed(await repo.productCounts(await manual(empty), userId, "cardmarket"));

    expect(byProduct.get(`${sharedExternalId}:normal`)).toEqual({
      idProduct: sharedExternalId,
      finish: "normal",
      owned: 3,
      wanted: 0,
      priceCents: EN_CENTS,
    });
    expect(byProduct.get(`${sharedExternalId}:foil`)).toEqual({
      idProduct: sharedExternalId,
      finish: "foil",
      owned: 1,
      wanted: 0,
      priceCents: FOIL_EN_CENTS,
    });
  });

  it("wishListsForUser returns the caller's wish lists ordered by name", async () => {
    expect(await repo.wishListsForUser([listId, secondListId], userId)).toEqual([
      { id: secondListId, name: "Overlay Extra Wants" },
      { id: listId, name: "Overlay Wants" },
    ]);
  });

  it("wishListsForUser drops another user's list, a trade list and an organize list", async () => {
    expect(await repo.wishListsForUser([listId], "a0000000-0032-4000-a000-000000000002")).toEqual(
      [],
    );

    const organize = await createList("Overlay Binder Plan", "organize");

    expect(await repo.wishListsForUser([listId, tradeListId], userId)).toEqual([
      { id: listId, name: "Overlay Wants" },
    ]);
    expect(await repo.wishListsForUser([listId, organize], userId)).toEqual([
      { id: listId, name: "Overlay Wants" },
    ]);
  });
});
