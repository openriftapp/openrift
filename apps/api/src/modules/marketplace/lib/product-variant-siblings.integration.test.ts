import { joinCatalog } from "@openrift/shared/catalog-join";
import { summarizeVariantSiblings } from "@openrift/shared/printing-label";
import type { VariantSiblingSummary } from "@openrift/shared/printing-label";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRepos } from "../../../deps.js";
import {
  createDbContext,
  deletePrintingsByFace,
  insertCards,
  insertPrinting,
  refreshCardAggregates,
} from "../../../test/integration-context.js";
import { catalogMutationsRepo } from "../../catalog/repositories/catalog-mutations.js";
import { assembleCatalogResponse } from "../../catalog/services/catalog-assembly.js";
import { toVariantSiblings } from "./product-presenters.js";

// Uses prefix PVS- for entities it creates.

const ctx = createDbContext("a0000000-0352-4000-a000-000000000001");

function sorted(summary: VariantSiblingSummary | undefined) {
  if (!summary) {
    return summary;
  }
  const byJson = <T>(values: T[]) =>
    values.toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    languages: summary.languages.toSorted(),
    rarities: summary.rarities.toSorted(),
    finishes: summary.finishes.toSorted(),
    markerSlugs: byJson(summary.markerSlugs),
    signed: summary.signed.toSorted(),
    otherSides: byJson(summary.otherSides),
  };
}

describe.skipIf(!ctx)("product variant siblings (integration)", () => {
  const { db } = ctx!;
  const repos = createRepos(db);
  const cardIds: Record<string, string> = {};
  let setId = "";

  function sideValues(card: string, shortCode: string, language = "EN") {
    return {
      cardId: cardIds[card]!,
      setId,
      shortCode,
      rarity: "common" as const,
      artVariant: "normal" as const,
      isSigned: false,
      isOvernumbered: false,
      markerSlugs: [],
      finish: "normal" as const,
      size: "standard" as const,
      artist: "PVS Artist",
      publicCode: shortCode,
      printedRulesText: null,
      printedEffectText: null,
      flavorText: null,
      language,
      printedName: null,
      printedYear: null,
    };
  }

  beforeAll(async () => {
    const [set] = await db
      .insertInto("sets")
      .values({ slug: "PVS-TEST", name: "PVS Test Set", printedTotal: 10, sortOrder: 952 })
      .returning("id")
      .execute();
    setId = set!.id;
    for (const name of ["Recruit", "Sprite"]) {
      const [card] = await insertCards(db, {
        name,
        slug: `pvs-${name.toLowerCase()}`,
        types: ["other"],
        normName: `pvs-${name.toLowerCase()}`,
        keywords: [],
        tags: [],
      });
      cardIds[name] = card!.id;
    }
    const { faceId: spriteFace } = await insertPrinting(db, {
      ...sideValues("Sprite", "PVS-T02"),
      comment: null,
    });
    await insertPrinting(db, { ...sideValues("Recruit", "PVS-T01", "FR"), comment: null });
    await catalogMutationsRepo(db).upsertPrinting(sideValues("Recruit", "PVS-T01"), spriteFace);
    await refreshCardAggregates(db);
  });

  afterAll(async () => {
    await db
      .deleteFrom("printingEvents")
      .where(
        "printingId",
        "in",
        db
          .selectFrom("printings")
          .innerJoin("faces", "faces.id", "printings.face1Id")
          .select("printings.id")
          .where("faces.setId", "=", setId),
      )
      .execute();
    await deletePrintingsByFace(db, "setId", "=", setId);
    await db.deleteFrom("cards").where("id", "in", Object.values(cardIds)).execute();
    await db.deleteFrom("sets").where("id", "=", setId).execute();
  });

  it("summarizes every card the same as the full catalog's printings of that card", async () => {
    const catalog = await assembleCatalogResponse(repos);
    const { printings } = joinCatalog(catalog);
    const expected = Map.groupBy(printings, (printing) => printing.cardId);
    const cardIdList = [...expected.keys()];

    const rows = await repos.catalog.variantSiblingRowsByCardIds(cardIdList);
    const actual = toVariantSiblings(rows, new Set(catalog.markers.map((m) => m.slug)));

    expect(actual[cardIds.Sprite!]?.otherSides).toEqual([
      { shortCode: "PVS-T02", cardName: "Recruit", otherShortCode: "PVS-T01" },
    ]);
    expect(actual[cardIds.Recruit!]?.languages.toSorted()).toEqual(["EN", "FR"]);
    for (const [cardId, siblings] of expected) {
      expect(sorted(actual[cardId]), cardId).toEqual(sorted(summarizeVariantSiblings(siblings)));
    }
    expect(Object.keys(actual).toSorted()).toEqual(cardIdList.toSorted());
  });
});
