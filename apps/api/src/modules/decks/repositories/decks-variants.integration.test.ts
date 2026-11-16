import { sleep } from "@openrift/shared/async";
import type { Selectable } from "kysely";
import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";

import type { DecksTable } from "../../../db/tables/decks.js";
import {
  CARD_BODY_UNIT,
  CARD_CALM_UNIT,
  CARD_FURY_UNIT,
  PRINTING_1,
} from "../../../test/fixtures/constants.js";
import { createDbContext, seedTestUser } from "../../../test/integration-context.js";
import { holdRow, waitUntilBlockedBy } from "../../../test/row-locks.js";
import { deckFoldersRepo } from "./deck-folders.js";
import { deckPlansRepo } from "./deck-plans.js";
import { decksRepo } from "./decks.js";

const ctx = createDbContext(crypto.randomUUID());

const MISSING_DECK_ID = "00000000-0000-4000-a000-000000000000";

let userId: string;
let otherUserId: string;
let collectionId: string;

if (ctx) {
  const { db } = ctx;

  const user = await seedTestUser(db);
  const other = await seedTestUser(db);
  userId = user.id;
  otherUserId = other.id;

  const collection = await db
    .insertInto("collections")
    .values({
      userId,
      groupId: null,
      name: "DV Deck Box",
      description: null,
      isInbox: false,
      sortOrder: 0,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  collectionId = collection.id;

  afterAll(async () => {
    // decks, deck_cards, deck_plans, and collections all cascade from users.
    await db.deleteFrom("users").where("id", "in", [userId, otherUserId]).execute();
  });
}

describe.skipIf(!ctx)("decksRepo variants", () => {
  const { db } = ctx!;
  const decks = decksRepo(db);
  const plans = deckPlansRepo(db);
  const folders = deckFoldersRepo(db);

  async function makeDeck(
    name: string,
    opts?: { owner?: string },
  ): Promise<Selectable<DecksTable>> {
    return decks.create({
      userId: opts?.owner ?? userId,
      name,
      description: null,
      format: "constructed",
      formatConfig: null,
      isPublic: false,
    });
  }

  async function copyOf(
    sourceId: string,
    input: { name?: string },
    owner = userId,
  ): Promise<Selectable<DecksTable>> {
    const copy = await decks.createVariantCopy(sourceId, owner, input);
    expect(copy).toBeDefined();
    return copy as Selectable<DecksTable>;
  }

  async function reload(id: string): Promise<Selectable<DecksTable>> {
    return db.selectFrom("decks").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
  }

  async function linkOf(
    id: string,
    input: { otherDeckId: string; markAsPreviousVersion?: boolean },
    owner = userId,
  ): Promise<Selectable<DecksTable>> {
    const result = await decks.linkAsVariant(id, owner, input);
    expect(result).not.toBe("not-found");
    expect(result).not.toBe("invalid");
    return result as Selectable<DecksTable>;
  }

  async function unlinkOf(id: string, owner = userId): Promise<Selectable<DecksTable>> {
    const result = await decks.unlinkVariant(id, owner);
    expect(result).not.toBe("not-found");
    expect(result).not.toBe("no-family");
    return result as Selectable<DecksTable>;
  }

  async function familyMembers(familyId: string | null): Promise<Selectable<DecksTable>[]> {
    if (familyId === null) {
      return [];
    }
    return db
      .selectFrom("decks")
      .selectAll()
      .where("familyId", "=", familyId)
      .orderBy("updatedAt", "desc")
      .execute();
  }

  describe("family creation", () => {
    it("creates the family on the first copy and makes the source primary", async () => {
      const source = await makeDeck("DV Family Source");
      expect(source.familyId).toBeNull();
      expect(source.isPrimary).toBe(false);

      const copy = await copyOf(source.id, {});
      expect(copy.familyId).toBeTypeOf("string");
      expect(copy.isPrimary).toBe(false);

      const reloadedSource = await reload(source.id);
      expect(reloadedSource.familyId).toBe(copy.familyId);
      expect(reloadedSource.isPrimary).toBe(true);
      expect(reloadedSource.updatedAt.toISOString()).toBe(source.updatedAt.toISOString());
    });

    it("reuses the existing family for later copies and keeps the primary", async () => {
      const source = await makeDeck("DV Family Reuse");
      const first = await copyOf(source.id, {});
      const second = await copyOf(source.id, {});

      expect(second.familyId).toBe(first.familyId);
      expect(second.isPrimary).toBe(false);
      const reloadedFirst = await reload(first.id);
      expect(reloadedFirst.isPrimary).toBe(false);
      const reloadedSource = await reload(source.id);
      expect(reloadedSource.isPrimary).toBe(true);
      const members = await db
        .selectFrom("decks")
        .select("id")
        .where("familyId", "=", first.familyId)
        .execute();
      expect(members).toHaveLength(3);
    });

    it("returns undefined for a missing deck and for another user's deck", async () => {
      const foreign = await makeDeck("DV Not Yours", { owner: otherUserId });
      const missing = await decks.createVariantCopy(MISSING_DECK_ID, userId, {});
      expect(missing).toBeUndefined();
      const notMine = await decks.createVariantCopy(foreign.id, userId, {});
      expect(notMine).toBeUndefined();

      const reloaded = await reload(foreign.id);
      expect(reloaded.familyId).toBeNull();
    });
  });

  describe("primary on a copy of a non-primary member", () => {
    it("leaves the family's primary where it is", async () => {
      const source = await makeDeck("DV Family Branch Primary");
      const variant = await copyOf(source.id, {});
      const branch = await copyOf(variant.id, {});

      expect(branch.isPrimary).toBe(false);
      const reloadedVariant = await reload(variant.id);
      expect(reloadedVariant.isPrimary).toBe(false);
      const reloadedSource = await reload(source.id);
      expect(reloadedSource.isPrimary).toBe(true);
    });
  });

  describe("lineage", () => {
    it("points a variant at the deck it was copied from", async () => {
      const source = await makeDeck("DV Variant Pointer");
      const copy = await copyOf(source.id, {});

      expect(copy.predecessorDeckId).toBe(source.id);
      const reloadedSource = await reload(source.id);
      expect(reloadedSource.predecessorDeckId).toBeNull();
    });

    it("branches a variant off another variant without touching the source", async () => {
      const source = await makeDeck("DV Branch Source");
      const variant = await copyOf(source.id, {});
      const branch = await copyOf(variant.id, {});

      expect(branch.predecessorDeckId).toBe(variant.id);
      expect(branch.familyId).toBe(variant.familyId);
      const reloadedSource = await reload(source.id);
      expect(reloadedSource.predecessorDeckId).toBeNull();
    });
  });

  describe("copied content", () => {
    it("copies deck cards with their zones, quantities, and preferred printings", async () => {
      const source = await makeDeck("DV Cards Source");
      await decks.replaceCards(source.id, [
        {
          cardId: CARD_FURY_UNIT.id,
          zone: "main",
          quantity: 3,
          preferredPrintingId: PRINTING_1.id,
        },
        { cardId: CARD_CALM_UNIT.id, zone: "sideboard", quantity: 2, preferredPrintingId: null },
      ]);

      const copy = await copyOf(source.id, {});
      const copied = await decks.cardsForDeck(copy.id, userId);
      expect(copied).toHaveLength(2);
      const fury = copied.find((card) => card.cardId === CARD_FURY_UNIT.id);
      expect(fury?.zone).toBe("main");
      expect(fury?.quantity).toBe(3);
      expect(fury?.preferredPrintingId).toBe(PRINTING_1.id);
      const calm = copied.find((card) => card.cardId === CARD_CALM_UNIT.id);
      expect(calm?.zone).toBe("sideboard");
      expect(calm?.quantity).toBe(2);
      expect(calm?.preferredPrintingId).toBeNull();

      const sourceCards = await decks.cardsForDeck(source.id, userId);
      expect(sourceCards).toHaveLength(2);
    });

    it("copies the deck plan, its matchups, and their swaps", async () => {
      const source = await makeDeck("DV Plan Source");
      await plans.replaceForDeck(source.id, {
        generalStrategy: "Grind the mid game",
        mulliganSplit: true,
        mulliganGeneral: "",
        mulliganFirst: "Keep removal",
        mulliganSecond: "Keep threats",
        battlefieldG1CardId: CARD_BODY_UNIT.id,
        battlefieldFirstCardId: null,
        battlefieldSecondCardId: null,
        battlefieldCustom: false,
        battlefieldNote: "Take the wide board",
        matchups: [
          {
            opponentCardId: CARD_CALM_UNIT.id,
            opponentLabel: "Calm control",
            notes: "Race them",
            swaps: [
              { cardId: CARD_FURY_UNIT.id, direction: "in", quantity: 2 },
              { cardId: CARD_BODY_UNIT.id, direction: "out", quantity: 2 },
            ],
          },
          { opponentCardId: null, opponentLabel: "Aggro", notes: "", swaps: [] },
        ],
      });

      const copy = await copyOf(source.id, {});
      const copiedPlan = await plans.getForDeck(copy.id);
      expect(copiedPlan.plan?.generalStrategy).toBe("Grind the mid game");
      expect(copiedPlan.plan?.mulliganSplit).toBe(true);
      expect(copiedPlan.plan?.mulliganFirst).toBe("Keep removal");
      expect(copiedPlan.plan?.battlefieldG1CardId).toBe(CARD_BODY_UNIT.id);
      expect(copiedPlan.plan?.battlefieldNote).toBe("Take the wide board");

      expect(copiedPlan.matchups.map((matchup) => matchup.opponentLabel)).toEqual([
        "Calm control",
        "Aggro",
      ]);
      const [first] = copiedPlan.matchups;
      expect(first?.opponentCardId).toBe(CARD_CALM_UNIT.id);
      expect(first?.notes).toBe("Race them");
      expect(first?.swaps).toHaveLength(2);
      expect(first?.swaps.find((swap) => swap.direction === "in")?.cardId).toBe(CARD_FURY_UNIT.id);
      expect(first?.swaps.find((swap) => swap.direction === "out")?.quantity).toBe(2);

      const sourcePlan = await plans.getForDeck(source.id);
      expect(sourcePlan.plan).toBeDefined();
      expect(sourcePlan.matchups).toHaveLength(2);
      expect(sourcePlan.matchups[0]?.id).not.toBe(first?.id);
    });

    it("leaves the copy without a plan when the source has none", async () => {
      const source = await makeDeck("DV No Plan");
      const copy = await copyOf(source.id, {});
      const copiedPlan = await plans.getForDeck(copy.id);
      expect(copiedPlan.plan).toBeUndefined();
      expect(copiedPlan.matchups).toEqual([]);
    });

    it("copies the deck's settings but never its shared state", async () => {
      const source = await makeDeck("DV Settings Source");
      await decks.update(source.id, userId, {
        description: "Budget build",
        format: "freeform",
        oddsConfig: {
          customGroups: [{ key: "removal", label: "Removal", types: ["spell"] }],
          selection: ["removal"],
        },
        coverCardId: CARD_FURY_UNIT.id,
        coverFaceId: PRINTING_1.id,
        coverPosition: 40,
        collectionId,
        links: [{ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Guide" }],
        isPinned: true,
      });
      await decks.setShare(source.id, userId, "dvsharetok01", true);

      const copy = await copyOf(source.id, {});
      expect(copy.description).toBe("Budget build");
      expect(copy.format).toBe("freeform");
      expect(copy.oddsConfig?.selection).toEqual(["removal"]);
      expect(copy.oddsConfig?.customGroups[0]?.key).toBe("removal");
      expect(copy.coverCardId).toBe(CARD_FURY_UNIT.id);
      expect(copy.coverFaceId).toBe(PRINTING_1.id);
      expect(copy.coverPosition).toBe(40);
      expect(copy.links).toEqual([
        { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Guide" },
      ]);

      expect(copy.isPublic).toBe(false);
      expect(copy.shareToken).toBeNull();
      expect(copy.isPinned).toBe(false);
      expect(copy.isDraft).toBe(false);
      expect(copy.archivedAt).toBeNull();
    });

    it("adds the copy to every folder the source is in", async () => {
      const source = await makeDeck("DV Folder Source");
      const folder = await folders.create(userId, "DV Folder");
      await folders.setForDeck(source.id, userId, [folder.id]);

      const copy = await copyOf(source.id, {});

      const byDeck = await folders.folderIdsByDeckIds([source.id, copy.id], userId);
      expect(byDeck.get(copy.id)).toEqual([folder.id]);
      expect(byDeck.get(source.id)).toEqual([folder.id]);
    });

    it("leaves a copy of a folderless deck out of every folder", async () => {
      const source = await makeDeck("DV No Folder Source");
      const copy = await copyOf(source.id, {});

      const byDeck = await folders.folderIdsByDeckIds([copy.id], userId);
      expect(byDeck.has(copy.id)).toBe(false);
    });

    it("leaves the copy out of the source's deck box", async () => {
      const source = await makeDeck("DV Box Source");
      await decks.update(source.id, userId, { collectionId });

      const variant = await copyOf(source.id, {});

      expect(variant.collectionId).toBeNull();
      const reloadedSource = await reload(source.id);
      expect(reloadedSource.collectionId).toBe(collectionId);
    });

    it("copies the format config", async () => {
      const source = await makeDeck("DV Format Config");
      await decks.update(source.id, userId, {
        format: "constructed",
        formatConfig: { tagSlugs: ["bilgewater", "neutral"] },
      });

      const copy = await copyOf(source.id, {});
      expect(copy.formatConfig).toEqual({ tagSlugs: ["bilgewater", "neutral"] });
    });
  });

  describe("naming and wanted state", () => {
    it("suffixes the source name when no name is given", async () => {
      const source = await makeDeck("DV Named");
      const variant = await copyOf(source.id, {});

      expect(variant.name).toBe("DV Named (variant)");
    });

    it("uses an explicit name verbatim", async () => {
      const source = await makeDeck("DV Explicit Name");
      const copy = await copyOf(source.id, { name: "Store event list" });
      expect(copy.name).toBe("Store event list");
    });
  });

  describe("promoteToPrimary", () => {
    it("moves the primary flag to the target and demotes the old primary", async () => {
      const source = await makeDeck("DV Promote Source");
      const copy = await copyOf(source.id, {});
      const promoted = await decks.promoteToPrimary(copy.id, userId);

      expect(promoted).not.toBe("not-found");
      expect(promoted).not.toBe("no-family");
      expect(typeof promoted === "object" && promoted.isPrimary).toBe(true);
      const reloadedSource = await reload(source.id);
      expect(reloadedSource.isPrimary).toBe(false);
      const reloadedCopy = await reload(copy.id);
      expect(reloadedCopy.isPrimary).toBe(true);
    });

    it("keeps one primary when two siblings are promoted at once", async () => {
      const source = await makeDeck("DV Promote Race");
      const first = await copyOf(source.id, {});
      const second = await copyOf(source.id, {});

      const results = await Promise.allSettled([
        decks.promoteToPrimary(first.id, userId),
        decks.promoteToPrimary(second.id, userId),
        decks.promoteToPrimary(source.id, userId),
      ]);

      expect(results.filter((result) => result.status === "rejected")).toEqual([]);
      const { familyId } = await reload(source.id);
      const primaries = await db
        .selectFrom("decks")
        .select("id")
        .where("familyId", "=", familyId)
        .where("isPrimary", "=", true)
        .execute();
      expect(primaries).toHaveLength(1);
    });

    it("keeps exactly one primary when the target already is the primary", async () => {
      const source = await makeDeck("DV Promote Primary");
      await copyOf(source.id, {});
      const promoted = await decks.promoteToPrimary(source.id, userId);

      expect(typeof promoted === "object" && promoted.isPrimary).toBe(true);
      const { familyId } = await reload(source.id);
      expect(familyId).not.toBeNull();
      const primaries = await db
        .selectFrom("decks")
        .select("id")
        .where("familyId", "=", familyId)
        .where("isPrimary", "=", true)
        .execute();
      expect(primaries).toHaveLength(1);
    });

    it("reports no-family for a standalone deck", async () => {
      const standalone = await makeDeck("DV Promote Standalone");
      const result = await decks.promoteToPrimary(standalone.id, userId);
      expect(result).toBe("no-family");
    });

    it("reports not-found for a missing deck and for another user's deck", async () => {
      const foreign = await makeDeck("DV Promote Foreign", { owner: otherUserId });
      const foreignCopy = await copyOf(foreign.id, {}, otherUserId);

      const missing = await decks.promoteToPrimary(MISSING_DECK_ID, userId);
      expect(missing).toBe("not-found");
      const notMine = await decks.promoteToPrimary(foreignCopy.id, userId);
      expect(notMine).toBe("not-found");
      const reloadedForeign = await reload(foreign.id);
      expect(reloadedForeign.isPrimary).toBe(true);
      const reloadedCopy = await reload(foreignCopy.id);
      expect(reloadedCopy.isPrimary).toBe(false);
    });
  });

  describe("updated_at", () => {
    it("is left alone by promoting, relinking and unlinking", async () => {
      const source = await makeDeck("DV Stamp Source");
      const copy = await copyOf(source.id, {});
      const outsider = await makeDeck("DV Stamp Outsider");
      const before = await Promise.all([source.id, copy.id, outsider.id].map((id) => reload(id)));

      await decks.promoteToPrimary(copy.id, userId);
      await decks.setPredecessor(copy.id, userId, null);
      await linkOf(outsider.id, { otherDeckId: source.id });
      await unlinkOf(outsider.id);

      const after = await Promise.all([source.id, copy.id, outsider.id].map((id) => reload(id)));
      expect(after.map((row) => row.updatedAt.toISOString())).toEqual(
        before.map((row) => row.updatedAt.toISOString()),
      );
      expect(after.map((row) => row.updatedXid)).not.toEqual(before.map((row) => row.updatedXid));
    });

    it("still moves on a content edit", async () => {
      const deck = await makeDeck("DV Stamp Edit");
      await decks.update(deck.id, userId, { name: "DV Stamp Edit (renamed)" });
      const moved = await db
        .selectFrom("decks")
        .select(sql<boolean>`updated_at > created_at`.as("moved"))
        .where("id", "=", deck.id)
        .executeTakeFirstOrThrow();
      expect(moved.moved).toBe(true);
    });
  });

  describe("family names", () => {
    async function familyRow(familyId: string | null) {
      if (familyId === null) {
        return undefined;
      }
      return db
        .selectFrom("deckFamilies")
        .selectAll()
        .where("id", "=", familyId)
        .executeTakeFirst();
    }

    it("creates an unnamed family row on the first copy and names it", async () => {
      const source = await makeDeck("DV Name Source");
      const copy = await copyOf(source.id, {});
      const unnamed = await familyRow(copy.familyId);
      expect(unnamed?.name).toBeNull();

      const result = await decks.setFamilyName(source.id, userId, "DV Orianna");
      expect(result).toEqual({ familyId: copy.familyId, name: "DV Orianna" });
      const names = await decks.familyNamesForUser(userId);
      expect(names.get(copy.familyId as string)).toBe("DV Orianna");

      await decks.setFamilyName(copy.id, userId, null);
      const cleared = await familyRow(copy.familyId);
      expect(cleared?.name).toBeNull();
    });

    it("reports no-family for a standalone deck and not-found for someone else's", async () => {
      const standalone = await makeDeck("DV Name Standalone");
      expect(await decks.setFamilyName(standalone.id, userId, "X")).toBe("no-family");

      const foreign = await makeDeck("DV Name Foreign", { owner: otherUserId });
      await copyOf(foreign.id, {}, otherUserId);
      expect(await decks.setFamilyName(foreign.id, userId, "X")).toBe("not-found");
    });

    it("keeps the surviving name on a merge and drops the absorbed row", async () => {
      const left = await makeDeck("DV Merge Left");
      const leftCopy = await copyOf(left.id, {});
      const right = await makeDeck("DV Merge Right");
      const rightCopy = await copyOf(right.id, {});
      await decks.setFamilyName(right.id, userId, "DV Right Group");

      await linkOf(left.id, { otherDeckId: right.id });

      const survivor = await familyRow(leftCopy.familyId);
      expect(survivor?.name).toBe("DV Right Group");
      expect(await familyRow(rightCopy.familyId)).toBeUndefined();
      const rows = await Promise.all(
        [left.id, right.id, leftCopy.id, rightCopy.id].map((id) => reload(id)),
      );
      expect(new Set(rows.map((row) => row.familyId))).toEqual(new Set([leftCopy.familyId]));
    });

    it("drops the family row when unlinking leaves one deck", async () => {
      const source = await makeDeck("DV Name Unlink");
      const copy = await copyOf(source.id, {});
      await unlinkOf(copy.id);
      expect(await familyRow(copy.familyId)).toBeUndefined();
    });

    it("drops the family row when deleting leaves one deck", async () => {
      const source = await makeDeck("DV Name Delete");
      const copy = await copyOf(source.id, {});
      await decks.deleteByIdForUser(copy.id, userId);
      expect(await familyRow(copy.familyId)).toBeUndefined();
    });
  });

  describe("setPredecessor", () => {
    it("points a member at another member of the same family", async () => {
      const source = await makeDeck("DV Parent Source");
      const first = await copyOf(source.id, {});
      const second = await copyOf(source.id, {});

      const updated = await decks.setPredecessor(second.id, userId, first.id);
      expect(typeof updated === "object" && updated.predecessorDeckId).toBe(first.id);
    });

    it("clears the pointer with null", async () => {
      const source = await makeDeck("DV Parent Clear");
      const copy = await copyOf(source.id, {});

      const updated = await decks.setPredecessor(copy.id, userId, null);
      expect(typeof updated === "object" && updated.predecessorDeckId).toBeNull();
    });

    it("rejects a deck pointed at itself", async () => {
      const source = await makeDeck("DV Parent Self");
      await copyOf(source.id, {});
      expect(await decks.setPredecessor(source.id, userId, source.id)).toBe("invalid");
    });

    it("rejects a pointer that would close a loop", async () => {
      const source = await makeDeck("DV Parent Loop");
      const child = await copyOf(source.id, {});
      const grandchild = await copyOf(child.id, {});

      expect(await decks.setPredecessor(source.id, userId, grandchild.id)).toBe("invalid");
      expect(await decks.setPredecessor(source.id, userId, child.id)).toBe("invalid");
      const unchanged = await reload(source.id);
      expect(unchanged.predecessorDeckId).toBeNull();
    });

    it("rejects a predecessor from another family", async () => {
      const source = await makeDeck("DV Parent Outsider Source");
      await copyOf(source.id, {});
      const stranger = await makeDeck("DV Parent Outsider Stranger");
      await copyOf(stranger.id, {});

      expect(await decks.setPredecessor(source.id, userId, stranger.id)).toBe("invalid");
    });

    it("rejects a standalone deck taking a predecessor", async () => {
      const standalone = await makeDeck("DV Parent Standalone");
      const other = await makeDeck("DV Parent Standalone Other");
      expect(await decks.setPredecessor(standalone.id, userId, other.id)).toBe("invalid");
    });

    it("reports not-found for a missing deck and for another user's deck", async () => {
      const foreign = await makeDeck("DV Parent Foreign", { owner: otherUserId });
      const foreignSibling = await copyOf(foreign.id, {}, otherUserId);

      expect(await decks.setPredecessor(MISSING_DECK_ID, userId, null)).toBe("not-found");
      expect(await decks.setPredecessor(foreign.id, userId, foreignSibling.id)).toBe("not-found");
      const source = await makeDeck("DV Parent Foreign Target");
      await copyOf(source.id, {});
      expect(await decks.setPredecessor(source.id, userId, foreignSibling.id)).toBe("not-found");
    });
  });

  describe("linkAsVariant", () => {
    it("gives two standalone decks a fresh family with this deck primary", async () => {
      const current = await makeDeck("DV Link Fresh Current");
      const other = await makeDeck("DV Link Fresh Other");

      const linked = await linkOf(current.id, { otherDeckId: other.id });
      expect(linked.familyId).toBeTypeOf("string");
      expect(linked.isPrimary).toBe(true);
      expect(linked.predecessorDeckId).toBeNull();

      const reloadedOther = await reload(other.id);
      expect(reloadedOther.familyId).toBe(linked.familyId);
      expect(reloadedOther.isPrimary).toBe(false);
    });

    it("joins the other deck's family and leaves its primary in place", async () => {
      const source = await makeDeck("DV Link Join Source");
      const sibling = await copyOf(source.id, {});
      const standalone = await makeDeck("DV Link Join Standalone");

      const linked = await linkOf(standalone.id, { otherDeckId: sibling.id });
      expect(linked.familyId).toBe(sibling.familyId);
      expect(linked.isPrimary).toBe(false);
      const reloadedSibling = await reload(sibling.id);
      expect(reloadedSibling.isPrimary).toBe(false);
      const reloadedSource = await reload(source.id);
      expect(reloadedSource.isPrimary).toBe(true);
    });

    it("pulls a standalone deck into this deck's family", async () => {
      const source = await makeDeck("DV Link Absorb Source");
      const sibling = await copyOf(source.id, {});
      const standalone = await makeDeck("DV Link Absorb Standalone");

      const linked = await linkOf(source.id, { otherDeckId: standalone.id });
      expect(linked.familyId).toBe(sibling.familyId);
      expect(linked.isPrimary).toBe(true);
      const reloadedSibling = await reload(sibling.id);
      expect(reloadedSibling.isPrimary).toBe(false);
      const reloadedStandalone = await reload(standalone.id);
      expect(reloadedStandalone.familyId).toBe(linked.familyId);
      expect(reloadedStandalone.isPrimary).toBe(false);
    });

    it("merges two families, moving every member and keeping one primary", async () => {
      const leftSource = await makeDeck("DV Merge Left");
      const leftSibling = await copyOf(leftSource.id, {});
      const rightSource = await makeDeck("DV Merge Right");
      const rightSibling = await copyOf(rightSource.id, {});

      const linked = await linkOf(leftSource.id, { otherDeckId: rightSource.id });
      expect(linked.familyId).toBe(leftSibling.familyId);
      expect(linked.isPrimary).toBe(true);
      const reloadedLeftSibling = await reload(leftSibling.id);
      expect(reloadedLeftSibling.isPrimary).toBe(false);

      const members = await familyMembers(linked.familyId);
      expect(members.map((member) => member.id).toSorted()).toEqual(
        [leftSource.id, leftSibling.id, rightSource.id, rightSibling.id].toSorted(),
      );
      expect(members.filter((member) => member.isPrimary)).toHaveLength(1);
      const reloadedRightSource = await reload(rightSource.id);
      expect(reloadedRightSource.isPrimary).toBe(false);
      expect(await familyMembers(rightSibling.familyId)).toHaveLength(0);
    });

    it("records the other deck as this deck's previous version when asked", async () => {
      const current = await makeDeck("DV Link Previous Newer");
      const other = await makeDeck("DV Link Previous Older");

      const linked = await linkOf(current.id, {
        otherDeckId: other.id,
        markAsPreviousVersion: true,
      });
      expect(linked.predecessorDeckId).toBe(other.id);
      const reloadedOther = await reload(other.id);
      expect(reloadedOther.predecessorDeckId).toBeNull();
    });

    it("ignores the previous-version flag when this deck already has one", async () => {
      const older = await makeDeck("DV Link Previous Kept");
      const source = await copyOf(older.id, {});
      const other = await makeDeck("DV Link Previous Ignored");

      const linked = await linkOf(source.id, {
        otherDeckId: other.id,
        markAsPreviousVersion: true,
      });
      expect(linked.predecessorDeckId).toBe(older.id);
    });

    it("reports invalid for a deck linked to itself", async () => {
      const deck = await makeDeck("DV Link Self");
      const result = await decks.linkAsVariant(deck.id, userId, { otherDeckId: deck.id });
      expect(result).toBe("invalid");
    });

    it("reports invalid for two decks that already share a family", async () => {
      const source = await makeDeck("DV Link Same Family");
      const sibling = await copyOf(source.id, {});
      const result = await decks.linkAsVariant(source.id, userId, { otherDeckId: sibling.id });
      expect(result).toBe("invalid");
    });

    it("reports not-found for a missing deck and for another user's deck", async () => {
      const mine = await makeDeck("DV Link Mine");
      const foreign = await makeDeck("DV Link Foreign", { owner: otherUserId });

      const missingCurrent = await decks.linkAsVariant(MISSING_DECK_ID, userId, {
        otherDeckId: mine.id,
      });
      expect(missingCurrent).toBe("not-found");
      const missingOther = await decks.linkAsVariant(mine.id, userId, {
        otherDeckId: MISSING_DECK_ID,
      });
      expect(missingOther).toBe("not-found");
      const notMine = await decks.linkAsVariant(mine.id, userId, { otherDeckId: foreign.id });
      expect(notMine).toBe("not-found");

      const reloadedMine = await reload(mine.id);
      expect(reloadedMine.familyId).toBeNull();
      const reloadedForeign = await reload(foreign.id);
      expect(reloadedForeign.familyId).toBeNull();
    });
  });

  describe("unlinkVariant", () => {
    it("closes the predecessor chain over the departing deck", async () => {
      const live = await makeDeck("DV Unlink Chain");
      const older = await copyOf(live.id, {});
      const newer = await copyOf(live.id, {});
      expect(await decks.setPredecessor(older.id, userId, null)).not.toBe("invalid");
      expect(await decks.setPredecessor(newer.id, userId, older.id)).not.toBe("invalid");
      expect(await decks.setPredecessor(live.id, userId, newer.id)).not.toBe("invalid");
      // Pin the recency order explicitly: relinking no longer stamps updated_at.
      await decks.update(live.id, userId, { name: "DV Unlink Chain (edited)" });

      const departed = await unlinkOf(newer.id);
      expect(departed.familyId).toBeNull();
      expect(departed.isPrimary).toBe(false);
      expect(departed.predecessorDeckId).toBeNull();

      const reloadedLive = await reload(live.id);
      expect(reloadedLive.predecessorDeckId).toBe(older.id);
      expect(reloadedLive.isPrimary).toBe(true);
    });

    it("promotes the most recently updated survivor when the primary leaves", async () => {
      const source = await makeDeck("DV Unlink Primary");
      const older = await copyOf(source.id, {});
      const newer = await copyOf(source.id, {});
      // Pin the recency order explicitly: the update trigger stamps now().
      await decks.update(older.id, userId, { name: "DV Unlink Primary (older)" });
      await decks.update(newer.id, userId, { name: "DV Unlink Primary (newer)" });

      const departed = await unlinkOf(source.id);
      expect(departed.familyId).toBeNull();
      expect(departed.isPrimary).toBe(false);

      const reloadedNewer = await reload(newer.id);
      const reloadedOlder = await reload(older.id);
      expect(reloadedNewer.isPrimary).toBe(true);
      expect(reloadedOlder.isPrimary).toBe(false);
      expect(reloadedNewer.predecessorDeckId).toBeNull();
      expect(reloadedOlder.predecessorDeckId).toBeNull();
    });

    it("turns the last survivor back into a standalone deck", async () => {
      const source = await makeDeck("DV Unlink To One");
      const older = await copyOf(source.id, {});
      await decks.setPredecessor(source.id, userId, older.id);

      await unlinkOf(older.id);

      const survivor = await reload(source.id);
      expect(survivor.familyId).toBeNull();
      expect(survivor.isPrimary).toBe(false);
      expect(survivor.predecessorDeckId).toBeNull();
    });

    it("reports no-family for a standalone deck", async () => {
      const standalone = await makeDeck("DV Unlink Standalone");
      const result = await decks.unlinkVariant(standalone.id, userId);
      expect(result).toBe("no-family");
    });

    it("reports not-found for a missing deck and for another user's deck", async () => {
      const foreign = await makeDeck("DV Unlink Foreign", { owner: otherUserId });
      const foreignCopy = await copyOf(foreign.id, {}, otherUserId);

      const missing = await decks.unlinkVariant(MISSING_DECK_ID, userId);
      expect(missing).toBe("not-found");
      const notMine = await decks.unlinkVariant(foreign.id, userId);
      expect(notMine).toBe("not-found");
      const reloadedForeign = await reload(foreign.id);
      expect(reloadedForeign.familyId).not.toBeNull();
      expect(reloadedForeign.isPrimary).toBe(true);
      const reloadedCopy = await reload(foreignCopy.id);
      expect(reloadedCopy.isPrimary).toBe(false);
    });
  });

  describe("deleteByIdForUser family repair", () => {
    it("promotes the most recently updated survivor when the primary is deleted", async () => {
      const source = await makeDeck("DV Delete Primary");
      const older = await copyOf(source.id, {});
      const newer = await copyOf(source.id, {});
      // Pin the recency order explicitly: the update trigger stamps now().
      await decks.update(older.id, userId, { name: "DV Delete Primary (older)" });
      await decks.update(newer.id, userId, { name: "DV Delete Primary (newer)" });

      expect(await decks.deleteByIdForUser(source.id, userId)).toBe(true);

      const reloadedNewer = await reload(newer.id);
      const reloadedOlder = await reload(older.id);
      expect(reloadedNewer.isPrimary).toBe(true);
      expect(reloadedOlder.isPrimary).toBe(false);
      expect(reloadedNewer.predecessorDeckId).toBeNull();
      expect(reloadedOlder.predecessorDeckId).toBeNull();
    });

    it("leaves the primary alone when a non-primary member is deleted", async () => {
      const source = await makeDeck("DV Delete Sibling");
      const first = await copyOf(source.id, {});
      const second = await copyOf(source.id, {});

      await decks.deleteByIdForUser(first.id, userId);

      const reloadedSecond = await reload(second.id);
      expect(reloadedSecond.isPrimary).toBe(false);
      expect(reloadedSecond.familyId).not.toBeNull();
      const reloadedSource = await reload(source.id);
      expect(reloadedSource.isPrimary).toBe(true);
      expect(reloadedSource.familyId).toBe(reloadedSecond.familyId);
    });

    it("turns the last survivor back into a standalone deck", async () => {
      const source = await makeDeck("DV Delete To One");
      const older = await copyOf(source.id, {});
      await decks.setPredecessor(source.id, userId, older.id);

      await decks.deleteByIdForUser(older.id, userId);

      const survivor = await reload(source.id);
      expect(survivor.familyId).toBeNull();
      expect(survivor.isPrimary).toBe(false);
      expect(survivor.predecessorDeckId).toBeNull();
    });

    it("still deletes a standalone deck and reports a miss for someone else's", async () => {
      const standalone = await makeDeck("DV Delete Standalone");
      expect(await decks.deleteByIdForUser(standalone.id, userId)).toBe(true);
      expect(await decks.deleteByIdForUser(standalone.id, userId)).toBe(false);

      const foreign = await makeDeck("DV Delete Foreign", { owner: otherUserId });
      expect(await decks.deleteByIdForUser(foreign.id, userId)).toBe(false);
      const survivor = await reload(foreign.id);
      expect(survivor.id).toBe(foreign.id);
    });
  });

  describe("lock order against cascading deletes", () => {
    async function lockableDeckIds(ids: string[]): Promise<string[]> {
      return db.transaction().execute(async (trx) => {
        const { rows } = await sql<{ id: string }>`
          SELECT id FROM decks WHERE id IN (${sql.join(ids)}) FOR UPDATE SKIP LOCKED
        `.execute(trx);
        return rows.map((row) => row.id).toSorted();
      });
    }

    async function waitsForOwnerBeforeDecks<T>(
      deckIds: string[],
      run: () => Promise<T>,
    ): Promise<T> {
      const owner = await holdRow(db, sql`SELECT 1 FROM users WHERE id = ${userId} FOR UPDATE`);
      let pending: Promise<T> | undefined;
      try {
        pending = run();
        await waitUntilBlockedBy(db, owner.pid);
        expect(await lockableDeckIds(deckIds)).toEqual(deckIds.toSorted());
      } finally {
        await owner.release();
      }
      return pending;
    }

    async function finishesWhileCollectionHeld<T>(run: () => Promise<T>): Promise<T | "blocked"> {
      const collection = await holdRow(
        db,
        sql`SELECT 1 FROM collections WHERE id = ${collectionId} FOR UPDATE`,
      );
      const pending = run();
      try {
        return await Promise.race([pending, sleep(3000).then(() => "blocked" as const)]);
      } finally {
        await collection.release();
        await pending.catch(() => null);
      }
    }

    it("createVariantCopy waits for the owner row before locking the source deck", async () => {
      const source = await makeDeck("DV Lock Copy Source");
      const copy = await waitsForOwnerBeforeDecks([source.id], () =>
        decks.createVariantCopy(source.id, userId, {}),
      );
      expect(copy?.familyId).toBeTypeOf("string");
    });

    it("linkAsVariant waits for the owner row before locking either deck", async () => {
      const current = await makeDeck("DV Lock Link Current");
      const other = await makeDeck("DV Lock Link Other");
      const linked = await waitsForOwnerBeforeDecks([current.id, other.id], () =>
        decks.linkAsVariant(current.id, userId, { otherDeckId: other.id }),
      );
      expect(linked).toMatchObject({ id: current.id, isPrimary: true });
    });

    it("unlinkVariant waits for the owner row before locking the departing deck", async () => {
      const source = await makeDeck("DV Lock Unlink Source");
      const copy = await copyOf(source.id, {});
      const departed = await waitsForOwnerBeforeDecks([source.id, copy.id], () =>
        decks.unlinkVariant(source.id, userId),
      );
      expect(departed).toMatchObject({ id: source.id, familyId: null });
    });

    it("linkAsVariant finishes while a deck's collection is held by a deletion", async () => {
      const current = await makeDeck("DV Lock Link Boxed");
      const other = await makeDeck("DV Lock Link Boxed Other");
      await decks.update(current.id, userId, { collectionId });
      await decks.update(other.id, userId, { collectionId });

      const outcome = await finishesWhileCollectionHeld(() =>
        decks.linkAsVariant(current.id, userId, {
          otherDeckId: other.id,
          markAsPreviousVersion: true,
        }),
      );
      expect(outcome).toMatchObject({
        id: current.id,
        isPrimary: true,
        predecessorDeckId: other.id,
      });
      const reloadedOther = await reload(other.id);
      expect(reloadedOther.familyId).toBe((outcome as Selectable<DecksTable>).familyId);
    });

    it("linkAsVariant merges two families while a member's collection is held", async () => {
      const leftSource = await makeDeck("DV Lock Merge Left");
      const leftSibling = await copyOf(leftSource.id, {});
      const rightSource = await makeDeck("DV Lock Merge Right");
      const rightSibling = await copyOf(rightSource.id, {});
      for (const deck of [leftSource, leftSibling, rightSource, rightSibling]) {
        await decks.update(deck.id, userId, { collectionId });
      }

      const outcome = await finishesWhileCollectionHeld(() =>
        decks.linkAsVariant(leftSource.id, userId, { otherDeckId: rightSource.id }),
      );
      expect(outcome).toMatchObject({
        id: leftSource.id,
        familyId: leftSibling.familyId,
        isPrimary: true,
      });
      const members = await familyMembers(leftSibling.familyId);
      expect(members.map((member) => member.id).toSorted()).toEqual(
        [leftSource.id, leftSibling.id, rightSource.id, rightSibling.id].toSorted(),
      );
      expect(members.filter((member) => member.isPrimary).map((member) => member.id)).toEqual([
        leftSource.id,
      ]);
    });

    it("unlinkVariant finishes while a survivor's collection is held by a deletion", async () => {
      const source = await makeDeck("DV Lock Unlink Boxed");
      const copy = await copyOf(source.id, {});
      await decks.update(copy.id, userId, { collectionId });

      const outcome = await finishesWhileCollectionHeld(() =>
        decks.unlinkVariant(source.id, userId),
      );
      expect(outcome).toMatchObject({ id: source.id, familyId: null });
      const survivor = await reload(copy.id);
      expect(survivor.familyId).toBeNull();
      expect(survivor.predecessorDeckId).toBeNull();
    });

    it("unlinkVariant finishes while a promoted survivor's collection is held", async () => {
      const source = await makeDeck("DV Lock Unlink Promote");
      const older = await copyOf(source.id, {});
      const newer = await copyOf(source.id, {});
      await decks.update(older.id, userId, { collectionId });
      await decks.update(newer.id, userId, { collectionId });

      const outcome = await finishesWhileCollectionHeld(() =>
        decks.unlinkVariant(source.id, userId),
      );
      expect(outcome).toMatchObject({ id: source.id, familyId: null });
      const promoted = await reload(newer.id);
      expect(promoted.isPrimary).toBe(true);
      expect(promoted.predecessorDeckId).toBeNull();
      const reloadedOlder = await reload(older.id);
      expect(reloadedOlder.isPrimary).toBe(false);
    });

    it("deleteByIdForUser waits for the owner row before locking the family", async () => {
      const source = await makeDeck("DV Lock Delete Source");
      const older = await copyOf(source.id, {});
      const newer = await copyOf(source.id, {});
      const deleted = await waitsForOwnerBeforeDecks([source.id, older.id, newer.id], () =>
        decks.deleteByIdForUser(source.id, userId),
      );
      expect(deleted).toBe(true);
    });

    it("deleteByIdForUser finishes while a promoted survivor's collection is held", async () => {
      const source = await makeDeck("DV Lock Delete Promote");
      const older = await copyOf(source.id, {});
      const newer = await copyOf(source.id, {});
      await decks.update(older.id, userId, { collectionId });
      await decks.update(newer.id, userId, { collectionId });

      const outcome = await finishesWhileCollectionHeld(() =>
        decks.deleteByIdForUser(source.id, userId),
      );
      expect(outcome).toBe(true);
      const promoted = await reload(newer.id);
      expect(promoted.isPrimary).toBe(true);
      expect(promoted.predecessorDeckId).toBeNull();
      const sibling = await reload(older.id);
      expect(sibling.isPrimary).toBe(false);
      expect(sibling.predecessorDeckId).toBeNull();
    });

    it("deleteByIdForUser finishes while a sole survivor's collection is held", async () => {
      const source = await makeDeck("DV Lock Delete To One");
      const copy = await copyOf(source.id, {});
      await decks.update(copy.id, userId, { collectionId });

      const outcome = await finishesWhileCollectionHeld(() =>
        decks.deleteByIdForUser(source.id, userId),
      );
      expect(outcome).toBe(true);
      const survivor = await reload(copy.id);
      expect(survivor.familyId).toBeNull();
      expect(survivor.isPrimary).toBe(false);
      expect(survivor.predecessorDeckId).toBeNull();
    });
  });
});
