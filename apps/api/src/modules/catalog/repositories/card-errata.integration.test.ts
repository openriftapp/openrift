import { afterAll, describe, expect, it } from "vitest";

import { createDbContext, refreshCardAggregates } from "../../../test/integration-context.js";
import { cardErrataRepo } from "./card-errata.js";
import { catalogCardsRepo } from "./catalog-cards.js";

// Uses the shared integration database. Requires INTEGRATION_DB_URL.
// Uses prefix ERA- for entities it creates.

const ctx = createDbContext(crypto.randomUUID());

let setId: string;
let announcedId: string;
let unannouncedId: string;
let announcementId: string;

async function seedCard(name: string, slug: string): Promise<string> {
  const [card] = await ctx!.db
    .insertInto("cards")
    .values({ name, slug, type: "unit", normName: slug, keywords: [], tags: [] })
    .returning("id")
    .execute();
  return card!.id;
}

async function seedPrinting(cardId: string, shortCode: string, printedRulesText: string) {
  await ctx!.db
    .insertInto("printings")
    .values({
      cardId,
      setId,
      shortCode,
      rarity: "common",
      artVariant: "normal",
      isSigned: false,
      finish: "normal",
      size: "standard",
      artist: "ERA Artist",
      publicCode: shortCode,
      printedRulesText,
      printedEffectText: null,
      flavorText: null,
      comment: null,
      language: "EN",
    })
    .execute();
}

if (ctx) {
  const { db } = ctx;

  const [set] = await db
    .insertInto("sets")
    .values({ slug: "ERA-TEST", name: "ERA Test Set", printedTotal: 3, sortOrder: 941 })
    .returning("id")
    .execute();
  setId = set!.id;

  announcedId = await seedCard("ERA Announced", "era-announced");
  unannouncedId = await seedCard("ERA Unannounced", "era-unannounced");
  await seedPrinting(announcedId, "ERA-001", "Draw two cards.");
  await seedPrinting(announcedId, "ERA-002", "Draw a card.");
  await seedPrinting(unannouncedId, "ERA-003", "Gain 1 point.");
  await refreshCardAggregates(db);

  announcementId = await cardErrataRepo(db).upsertAnnouncement({
    name: "ERA Errata Updates",
    publishedOn: "2026-07-23",
    url: "https://example.invalid/era",
  });
  await cardErrataRepo(db).upsert(announcedId, {
    announcementId,
    correctedRulesText: "Draw a card.",
    correctedEffectText: null,
    source: null,
    sourceUrl: null,
    effectiveDate: null,
  });
  await cardErrataRepo(db).upsert(unannouncedId, {
    announcementId: null,
    correctedRulesText: "Gain 2 points.",
    correctedEffectText: null,
    source: "ERA card gallery",
    sourceUrl: null,
    effectiveDate: "2026-08-01",
  });

  afterAll(async () => {
    await db.deleteFrom("cardErrata").where("cardId", "in", [announcedId, unannouncedId]).execute();
    await db.deleteFrom("errataAnnouncements").where("id", "=", announcementId).execute();
    await db.deleteFrom("printings").where("setId", "=", setId).execute();
    await db.deleteFrom("cards").where("id", "in", [announcedId, unannouncedId]).execute();
    await db.deleteFrom("sets").where("id", "=", setId).execute();
    await refreshCardAggregates(db);
  });
}

describe.skipIf(!ctx)("errata announcements", () => {
  it("reads an announced erratum's source from its announcement", async () => {
    const row = await catalogCardsRepo(ctx!.db).cardErrataByCardId(announcedId);
    expect(row).toMatchObject({
      source: "ERA Errata Updates",
      sourceUrl: "https://example.invalid/era",
      effectiveDate: "2026-07-23",
    });
  });

  it("keeps an unannounced erratum's own source", async () => {
    const row = await catalogCardsRepo(ctx!.db).cardErrataByCardId(unannouncedId);
    expect(row).toMatchObject({ source: "ERA card gallery", effectiveDate: "2026-08-01" });
  });

  it("upserts an announcement by name and keeps its id", async () => {
    const id = await cardErrataRepo(ctx!.db).upsertAnnouncement({
      name: "ERA Errata Updates",
      publishedOn: "2026-07-24",
      url: "https://example.invalid/era",
    });
    expect(id).toBe(announcementId);
    const rows = await cardErrataRepo(ctx!.db).announcements();
    expect(rows.find((row) => row.id === id)?.publishedOn).toBe("2026-07-24");
  });

  it("rejects an erratum with both an announcement and a source", async () => {
    await expect(
      cardErrataRepo(ctx!.db).upsert(unannouncedId, {
        announcementId,
        correctedRulesText: "Gain 2 points.",
        correctedEffectText: null,
        source: "ERA card gallery",
        sourceUrl: null,
        effectiveDate: null,
      }),
    ).rejects.toThrow();
  });

  it("lists entries with the printing whose text still differs", async () => {
    const rows = await cardErrataRepo(ctx!.db).listEntries();
    const announced = rows.find((row) => row.slug === "era-announced");
    expect(announced).toMatchObject({
      announcementId,
      shortCode: "ERA-001",
      printedRulesText: "Draw two cards.",
      setSlug: "ERA-TEST",
    });
    const unannounced = rows.find((row) => row.slug === "era-unannounced");
    expect(unannounced).toMatchObject({ announcementId: null, source: "ERA card gallery" });
  });
});
