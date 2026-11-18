import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import { candidateCardsRepo } from "./candidate-cards.js";

describe("candidateCardsRepo", () => {
  it("listCardsWithMissingImages groups the per-language rows by card", async () => {
    const db = createMockDb([
      { cardId: "c-1", slug: "OGS-001", name: "Annie", language: "EN", count: 1 },
      { cardId: "c-1", slug: "OGS-001", name: "Annie", language: "DE", count: 2 },
    ]);
    expect(await candidateCardsRepo(db).listCardsWithMissingImages()).toEqual([
      {
        cardId: "c-1",
        slug: "OGS-001",
        name: "Annie",
        byLanguage: [
          { language: "EN", count: 1 },
          { language: "DE", count: 2 },
        ],
      },
    ]);
  });

  it("distinctProviderNames returns string array", async () => {
    const db = createMockDb([{ provider: "tcgplayer" }]);
    const result = await candidateCardsRepo(db).distinctProviderNames();
    expect(result).toEqual(["tcgplayer"]);
  });

  it("providerStats returns lastUpdated as an ISO string", async () => {
    const db = createMockDb([
      {
        provider: "test",
        cardCount: 10,
        printingCount: 20,
        lastUpdated: new Date("2026-01-01T12:34:56.000Z"),
      },
    ]);
    const result = await candidateCardsRepo(db).providerStats();
    expect(result).toEqual([
      {
        provider: "test",
        cardCount: 10,
        printingCount: 20,
        lastUpdated: "2026-01-01T12:34:56.000Z",
      },
    ]);
  });

  it("checkAllCandidateCards counts the rows it flipped but returns every match", async () => {
    const { db } = createRecordingDb([[{ id: "cc-1" }], [{ id: "cc-1" }, { id: "cc-2" }]]);
    const result = await candidateCardsRepo(db).checkAllCandidateCards(["annie"], "c-1");
    expect(result).toEqual({ updated: 1, candidateCardIds: ["cc-1", "cc-2"] });
  });

  it("checkCandidateCards touches nothing for an empty id list", async () => {
    const db = createMockDb([{ id: "cc-1" }]);
    expect(await candidateCardsRepo(db).checkCandidateCards([])).toEqual({
      updated: 0,
      candidateCardIds: [],
    });
  });

  it("checkCandidateCards counts the rows it flipped and returns every given row that exists", async () => {
    const { db } = createRecordingDb([[{ id: "cc-1" }], [{ id: "cc-1" }, { id: "cc-2" }]]);
    expect(await candidateCardsRepo(db).checkCandidateCards(["cc-1", "cc-2", "cc-9"])).toEqual({
      updated: 1,
      candidateCardIds: ["cc-1", "cc-2"],
    });
  });

  it("uncheckCandidateCards counts the rows it cleared", async () => {
    const db = createMockDb([{ id: "cc-1" }, { id: "cc-2" }]);
    expect(await candidateCardsRepo(db).uncheckCandidateCards(["cc-1", "cc-2"])).toBe(2);
  });

  it("uncheckCandidatePrintings counts the rows it cleared", async () => {
    const db = createMockDb([{ id: "cp-1" }, { id: "cp-2" }]);
    expect(await candidateCardsRepo(db).uncheckCandidatePrintings(["cp-1", "cp-2"])).toBe(2);
  });

  it("checkAllCandidatePrintings touches nothing when no ids are provided", async () => {
    const db = createMockDb([{ candidateCardId: "cc-1" }]);
    expect(await candidateCardsRepo(db).checkAllCandidatePrintings()).toEqual({
      updated: 0,
      candidateCardIds: [],
    });
  });

  it.each([
    {
      name: "printingId",
      printingId: "p-1",
      extraIds: undefined,
      rows: [{ candidateCardId: "cc-1" }, { candidateCardId: "cc-2" }],
      expected: { updated: 2, candidateCardIds: ["cc-1", "cc-2"] },
    },
    {
      name: "extraIds",
      printingId: undefined,
      extraIds: ["cp-1"],
      rows: [{ candidateCardId: "cc-1" }],
      expected: { updated: 1, candidateCardIds: ["cc-1"] },
    },
  ])("checkAllCandidatePrintings with $name", async ({ printingId, extraIds, rows, expected }) => {
    const db = createMockDb(rows);
    expect(await candidateCardsRepo(db).checkAllCandidatePrintings(printingId, extraIds)).toEqual(
      expected,
    );
  });

  it("checkAllCandidatePrintings dedupes parents from the same candidate card", async () => {
    const db = createMockDb([
      { candidateCardId: "cc-1" },
      { candidateCardId: "cc-1" },
      { candidateCardId: "cc-2" },
    ]);
    expect(
      await candidateCardsRepo(db).checkAllCandidatePrintings("p-1", ["cp-1", "cp-2"]),
    ).toEqual({ updated: 3, candidateCardIds: ["cc-1", "cc-2"] });
  });

  it("deleteCandidatePrinting deletes a printing", async () => {
    const db = createMockDb([{ numDeletedRows: 1n }]);
    expect(await candidateCardsRepo(db).deleteCandidatePrinting("cp-1")).toBe(true);
  });

  it("copyCandidatePrinting takes the target's identity and falls back to the short code for the external id", async () => {
    const ps = {
      candidateCardId: "cc-1",
      shortCode: "OGS-001",
      setId: "ogs",
      setName: "Proving Grounds",
      rarity: "common",
      artist: "Artist",
      externalId: null,
    } as any;
    const target = {
      id: "p-new",
      rarity: "rare",
      artVariant: "normal",
      isSigned: true,
      isOvernumbered: false,
      markerSlugs: [],
      finish: "foil",
    };
    const { db, parameters } = createRecordingDb([[]]);
    await candidateCardsRepo(db).copyCandidatePrinting(ps, target);
    expect(parameters[0]).toEqual(
      expect.arrayContaining([
        "p-new",
        "rare",
        true,
        "foil",
        expect.stringMatching(/^OGS-001-copy-\d+$/u),
      ]),
    );
    expect(parameters[0]).not.toContain("common");
  });

  it("upsertPrintingLinkOverrides writes nothing when no candidate printing matches", async () => {
    const { db, queries } = createRecordingDb([[]]);
    await candidateCardsRepo(db).upsertPrintingLinkOverrides(["cp-1"], "p-1");
    expect(queries).toHaveLength(1);
  });

  it("upsertPrintingLinkOverrides dedupes on the conflict key and pins a null finish as empty", async () => {
    const { db, parameters } = createRecordingDb([
      [
        { external_id: "ext-1", finish: null, provider: "gallery" },
        { external_id: "ext-1", finish: null, provider: "gallery" },
        { external_id: "ext-2", finish: "foil", provider: "gallery" },
      ],
    ]);
    await candidateCardsRepo(db).upsertPrintingLinkOverrides(["cp-1", "cp-2", "cp-3"], "p-1");
    expect(parameters[1]).toEqual([
      "ext-1",
      "",
      "gallery",
      "p-1",
      "ext-2",
      "foil",
      "gallery",
      "p-1",
      "p-1",
    ]);
  });

  it("removePrintingLinkOverrides matches a null finish as empty", async () => {
    const { db, parameters } = createRecordingDb([
      [{ external_id: "ext-1", finish: null, provider: "gallery" }],
    ]);
    await candidateCardsRepo(db).removePrintingLinkOverrides(["cp-1"]);
    expect(parameters[1]).toEqual(["ext-1", "", "gallery"]);
  });

  it("removePrintingLinkOverrides deletes nothing when no candidate printing matches", async () => {
    const { db, queries } = createRecordingDb([[]]);
    await candidateCardsRepo(db).removePrintingLinkOverrides(["cp-1"]);
    expect(queries).toHaveLength(1);
  });

  it("checkByProvider returns check counts", async () => {
    const db = createMockDb([{ numUpdatedRows: 5n }]);
    const result = await candidateCardsRepo(db).checkByProvider("test", new Date());
    expect(result.cardsChecked).toBe(5);
    expect(result.printingsChecked).toBe(5);
  });

  it("deleteByProvider returns deleted count", async () => {
    const db = createMockDb([{ numDeletedRows: 10n }]);
    expect(await candidateCardsRepo(db).deleteByProvider("test")).toBe(10);
  });
});
