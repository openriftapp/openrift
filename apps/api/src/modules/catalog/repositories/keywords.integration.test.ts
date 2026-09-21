import { describe, expect, it } from "vitest";

import { createDbContext } from "../../../test/integration-context.js";
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

  it("getTranslationCandidates pairs each EN printing with its non-EN siblings", async () => {
    const rows = await repo.getTranslationCandidates();
    for (const row of rows) {
      expect(row.otherLanguage).not.toBe("EN");
      expect(row.enRulesText ?? row.enEffectText).not.toBeNull();
      expect(row.otherRulesText ?? row.otherEffectText).not.toBeNull();
    }
  });
});
