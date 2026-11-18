import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { SeededPrinting } from "../../../test/catalog-seed.js";
import { seedCatalogPrinting } from "../../../test/catalog-seed.js";
import { createDbContext, insertPrinting } from "../../../test/integration-context.js";
import { keywordsRepo } from "./keywords.js";

const ctx = createDbContext("a0000000-0043-4000-a000-000000000001");

describe.skipIf(!ctx)("keywordsRepo (integration)", () => {
  const { db } = ctx!;
  const repo = keywordsRepo(db);

  it("listAll returns keywords ordered by name", async () => {
    const styles = await repo.listAll();
    expect(Array.isArray(styles)).toBe(true);
    if (styles.length > 1) {
      const names = styles.map((s) => s.name);
      expect(names).toEqual([...names].sort());
    }
  });

  it("listCostKeywords returns only keywords flagged as cost keywords", async () => {
    await repo.upsertStyle({
      name: "KW-CostFlag",
      color: "#123456",
      darkText: false,
      costKeyword: true,
      cardModifier: false,
    });
    await repo.upsertStyle({
      name: "KW-PlainFlag",
      color: "#123456",
      darkText: false,
      costKeyword: false,
      cardModifier: false,
    });
    try {
      const costKeywords = await repo.listCostKeywords();
      expect(costKeywords).toContain("KW-CostFlag");
      expect(costKeywords).not.toContain("KW-PlainFlag");

      await repo.upsertStyle({
        name: "KW-CostFlag",
        color: "#123456",
        darkText: false,
        costKeyword: false,
        cardModifier: false,
      });
      expect(await repo.listCostKeywords()).not.toContain("KW-CostFlag");
    } finally {
      await repo.deleteStyle("KW-CostFlag");
      await repo.deleteStyle("KW-PlainFlag");
    }
  });

  it("patchStyleFlags inserts with the given color and then changes only the sent flag", async () => {
    try {
      await repo.patchStyleFlags("KW-PatchFlag", "#abcdef", { costKeyword: true });
      await repo.patchStyleFlags("KW-PatchFlag", "#000000", { cardModifier: true });
      expect(await repo.listCostKeywords()).toContain("KW-PatchFlag");
      expect(await repo.listCardModifierKeywords()).toContain("KW-PatchFlag");
      const keywords = await repo.listAll();
      const row = keywords.find((keyword) => keyword.name === "KW-PatchFlag");
      expect(row?.color).toBe("#abcdef");
    } finally {
      await repo.deleteStyle("KW-PatchFlag");
    }
  });

  it("listCardModifierKeywords returns only keywords flagged as card modifiers", async () => {
    await repo.upsertStyle({
      name: "KW-ModifierFlag",
      color: "#123456",
      darkText: false,
      costKeyword: false,
      cardModifier: true,
    });
    await repo.upsertStyle({
      name: "KW-NotModifierFlag",
      color: "#123456",
      darkText: false,
      costKeyword: false,
      cardModifier: false,
    });
    try {
      const modifiers = await repo.listCardModifierKeywords();
      expect(modifiers).toContain("KW-ModifierFlag");
      expect(modifiers).not.toContain("KW-NotModifierFlag");

      await repo.upsertStyle({
        name: "KW-ModifierFlag",
        color: "#123456",
        darkText: false,
        costKeyword: false,
        cardModifier: false,
      });
      expect(await repo.listCardModifierKeywords()).not.toContain("KW-ModifierFlag");
    } finally {
      await repo.deleteStyle("KW-ModifierFlag");
      await repo.deleteStyle("KW-NotModifierFlag");
    }
  });

  it("keyword style mutations leave cards.keywords alone", async () => {
    const before = await db.selectFrom("cards").select(["id", "keywords"]).orderBy("id").execute();

    await repo.createStyle({
      name: "KW-CacheProbe",
      color: "#abcdef",
      darkText: true,
      costKeyword: false,
      cardModifier: false,
    });
    try {
      const during = await db
        .selectFrom("cards")
        .select(["id", "keywords"])
        .orderBy("id")
        .execute();
      expect(during).toEqual(before);
    } finally {
      await repo.deleteStyle("KW-CacheProbe");
    }

    const after = await db.selectFrom("cards").select(["id", "keywords"]).orderBy("id").execute();
    expect(after).toEqual(before);
  });

  describe("recompute", () => {
    let target: SeededPrinting;
    let bystander: SeededPrinting;
    let stale: SeededPrinting;
    let current: SeededPrinting;

    async function setFaceText(seed: SeededPrinting, printedRulesText: string) {
      await db
        .updateTable("faces")
        .set({ printedRulesText })
        .where("id", "=", seed.faceId)
        .execute();
    }

    async function setKeywords(seed: SeededPrinting, keywords: string[]) {
      await db.updateTable("cards").set({ keywords }).where("id", "=", seed.cardId).execute();
    }

    async function siblingPrinting(seed: SeededPrinting, suffix: string, language: string) {
      await insertPrinting(db, {
        cardId: seed.cardId,
        setId: seed.setId,
        shortCode: `${seed.cardSlug}-${suffix}`,
        publicCode: `${seed.cardSlug}-${suffix}`,
        rarity: "common",
        artVariant: "normal",
        isSigned: false,
        finish: "normal",
        size: "standard",
        language,
        artist: "Test Artist",
        printedRulesText: language === "EN" ? "[Assault 1]" : "[Tank]",
      });
    }

    beforeAll(async () => {
      target = await seedCatalogPrinting(db, "kwr");
      bystander = await seedCatalogPrinting(db, "kwr");
      stale = await seedCatalogPrinting(db, "kwr");
      current = await seedCatalogPrinting(db, "kwr");

      await setFaceText(target, "[Shield 2]");
      await siblingPrinting(target, "002", "EN");
      await siblingPrinting(target, "003", "FR");
      await db
        .insertInto("cardErrata")
        .values({
          cardId: target.cardId,
          language: "EN",
          correctedRulesText: "[Deflect]",
          source: "KWR test",
        })
        .execute();
      await setKeywords(target, ["Stale"]);

      await setFaceText(bystander, "[Shield 2]");
      await setKeywords(bystander, ["Untouched"]);

      await setFaceText(stale, "[Shield 2]");
      await setKeywords(stale, ["Stale"]);

      await setFaceText(current, "[Assault 1]");
      await setKeywords(current, ["Assault"]);
    });

    afterAll(async () => {
      for (const seed of [target, bystander, stale, current]) {
        await seed?.cleanup();
      }
    });

    function keywordsOf(seed: SeededPrinting, reader = db) {
      return reader
        .selectFrom("cards")
        .select(["keywords", "updatedAt"])
        .where("id", "=", seed.cardId)
        .executeTakeFirstOrThrow();
    }

    it("recomputeForPrintingCard derives the card's keywords from its errata and English faces only", async () => {
      await repo.recomputeForPrintingCard(target.printingId);

      const recomputed = await keywordsOf(target);
      const untouched = await keywordsOf(bystander);
      expect(recomputed.keywords.toSorted()).toEqual(["Assault", "Deflect", "Shield"]);
      expect(untouched.keywords).toEqual(["Untouched"]);
    });

    it("recomputeAll rewrites stale keywords and leaves current ones unwritten", async () => {
      const currentBefore = await keywordsOf(current);

      // Rewrites every card in the shared database, so it runs in a rolled-back transaction.
      await expect(
        db.transaction().execute(async (trx) => {
          const result = await keywordsRepo(trx).recomputeAll();
          expect(result.updated).toBeGreaterThanOrEqual(1);
          const fixed = await keywordsOf(stale, trx);
          expect(fixed.keywords).toEqual(["Shield"]);
          expect(await keywordsOf(current, trx)).toEqual(currentBefore);
          throw new Error("rollback");
        }),
      ).rejects.toThrow("rollback");
    });
  });

  it("getTranslationCandidates pairs each EN printing with its non-EN siblings", async () => {
    const rows = await repo.getTranslationCandidates();
    for (const row of rows) {
      expect(row.otherLanguage).not.toBe("EN");
      expect(row.enRulesText ?? row.enEffectText).not.toBeNull();
      expect(row.otherRulesText ?? row.otherEffectText).not.toBeNull();
    }
  });
});
