import type {
  MarketplaceAssignmentResponse,
  StagedProductResponse,
  UnifiedMappingGroupResponse,
  UnifiedMappingPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { describe, expect, it } from "vitest";

import { collectEntries, displayedProductLanguage } from "./marketplace-product-entries";

function printing(
  overrides: Partial<UnifiedMappingPrintingResponse> = {},
): UnifiedMappingPrintingResponse {
  return {
    printingId: "p-en",
    setId: "ogn",
    shortCode: "OGN-001",
    rarity: "common",
    artVariant: "normal",
    isSigned: false,
    isOvernumbered: false,
    markerSlugs: [],
    finish: "normal",
    size: "standard",
    language: "EN",
    imageUrl: null,
    tcgExternalId: null,
    cmExternalId: null,
    ctExternalId: null,
    cnExternalId: null,
    ...overrides,
  };
}

function staged(overrides: Partial<StagedProductResponse> = {}): StagedProductResponse {
  return {
    externalId: 1,
    productName: "Product",
    finish: "normal",
    language: "EN",
    marketCents: 100,
    lowCents: null,
    zeroLowCents: null,
    midCents: null,
    highCents: null,
    trendCents: null,
    avg1Cents: null,
    avg7Cents: null,
    avg30Cents: null,
    currency: "USD",
    recordedAt: new Date().toISOString(),
    ...overrides,
  };
}

function group(
  printings: UnifiedMappingPrintingResponse[],
  perMarketplace: Partial<{
    tcgplayer: {
      staged: StagedProductResponse[];
      assigned: StagedProductResponse[];
      assignments: MarketplaceAssignmentResponse[];
    };
    cardmarket: {
      staged: StagedProductResponse[];
      assigned: StagedProductResponse[];
      assignments: MarketplaceAssignmentResponse[];
    };
    cardtrader: {
      staged: StagedProductResponse[];
      assigned: StagedProductResponse[];
      assignments: MarketplaceAssignmentResponse[];
    };
  }> = {},
): UnifiedMappingGroupResponse {
  const empty = { staged: [], assigned: [], assignments: [] };
  const tcg = { ...empty, ...perMarketplace.tcgplayer };
  const cm = { ...empty, ...perMarketplace.cardmarket };
  const ct = { ...empty, ...perMarketplace.cardtrader };
  return {
    cardId: "c-1",
    cardSlug: "fireball",
    cardName: "Fireball",
    superTypes: [],
    domains: ["fury"],
    energy: 1,
    might: null,
    setId: "set-1",
    setName: "Set",
    primaryShortCode: "OGN-001",
    printings,
    tcgplayer: {
      stagedProducts: tcg.staged,
      assignedProducts: tcg.assigned,
      assignments: tcg.assignments,
    },
    cardmarket: {
      stagedProducts: cm.staged,
      assignedProducts: cm.assigned,
      assignments: cm.assignments,
    },
    cardtrader: {
      stagedProducts: ct.staged,
      assignedProducts: ct.assigned,
      assignments: ct.assignments,
    },
    cardnexus: { stagedProducts: [], assignedProducts: [], assignments: [] },
  };
}

describe("collectEntries", () => {
  it("returns no entries when all marketplace buckets are empty", () => {
    const entries = collectEntries(group([printing()]));
    expect(entries).toEqual([]);
  });

  it("marks a product as assigned when assignedProducts contains its (externalId, finish, language) tuple", () => {
    const product = staged({ externalId: 1, finish: "normal", language: "EN" });
    const entries = collectEntries(
      group([printing({ printingId: "p-1" })], {
        cardtrader: {
          staged: [],
          assigned: [product],
          assignments: [{ externalId: 1, printingId: "p-1", finish: "normal", language: "EN" }],
        },
      }),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]!.isAssigned).toBe(true);
    expect([...entries[0]!.assignedPrintingIds]).toEqual(["p-1"]);
    expect(entries[0]!.assignedPrintings[0]).toMatchObject({
      printingId: "p-1",
      shortCode: "OGN-001",
      finish: "normal",
      language: "EN",
    });
  });

  it("does not cross-contaminate assigned printings across language variants for per-language marketplaces", () => {
    const enPrint = printing({ printingId: "p-en", language: "EN" });
    const scPrint = printing({ printingId: "p-sc", language: "SC" });
    const entries = collectEntries(
      group([enPrint, scPrint], {
        cardtrader: {
          staged: [staged({ externalId: 42, language: "EN" })],
          assigned: [staged({ externalId: 42, language: "SC" })],
          assignments: [{ externalId: 42, printingId: "p-sc", finish: "normal", language: "SC" }],
        },
      }),
    );
    const enEntry = entries.find((e) => e.product.language === "EN");
    const scEntry = entries.find((e) => e.product.language === "SC");
    expect(enEntry?.isAssigned).toBe(false);
    expect(enEntry?.assignedPrintings).toEqual([]);
    expect(scEntry?.isAssigned).toBe(true);
    expect(scEntry?.assignedPrintings.map((p) => p.printingId)).toEqual(["p-sc"]);
  });

  it("treats a null assignment language as matching every row language (Cardmarket aggregate)", () => {
    const enPrint = printing({ printingId: "p-en", language: "EN" });
    const scPrint = printing({ printingId: "p-sc", language: "SC" });
    const entries = collectEntries(
      group([enPrint, scPrint], {
        cardmarket: {
          staged: [],
          assigned: [
            staged({ externalId: 99, language: "EN" }),
            staged({ externalId: 99, language: "SC" }),
          ],
          assignments: [{ externalId: 99, printingId: "p-en", finish: "normal", language: null }],
        },
      }),
    );
    const enEntry = entries.find((e) => e.product.language === "EN");
    const scEntry = entries.find((e) => e.product.language === "SC");
    expect(enEntry?.assignedPrintings.map((p) => p.printingId)).toEqual(["p-en"]);
    expect(scEntry?.assignedPrintings.map((p) => p.printingId)).toEqual(["p-en"]);
  });

  it("lists a printing once when a null-language and a language assignment both cover it", () => {
    const enPrint = printing({ printingId: "p-en", language: "EN" });
    const entries = collectEntries(
      group([enPrint], {
        cardmarket: {
          staged: [],
          assigned: [staged({ externalId: 99, language: "EN" })],
          assignments: [
            { externalId: 99, printingId: "p-en", finish: "normal", language: null },
            { externalId: 99, printingId: "p-en", finish: "normal", language: "EN" },
          ],
        },
      }),
    );
    expect(entries[0]?.assignedPrintings.map((p) => p.printingId)).toEqual(["p-en"]);
  });

  it("lists every printing a multi-variant assignment covers", () => {
    const shared = printing({ printingId: "p-1", language: "EN" });
    const entries = collectEntries(
      group([shared], {
        cardmarket: {
          staged: [],
          assigned: [
            staged({ externalId: 100, language: "EN" }),
            staged({ externalId: 200, language: "EN" }),
          ],
          assignments: [
            { externalId: 100, printingId: "p-1", finish: "normal", language: null },
            { externalId: 200, printingId: "p-1", finish: "normal", language: null },
          ],
        },
      }),
    );
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(entry.assignedPrintings.map((p) => p.printingId)).toEqual(["p-1"]);
    }
  });

  it("dedupes rows that appear in both stagedProducts and assignedProducts", () => {
    const product = staged({ externalId: 5, finish: "normal", language: "EN" });
    const entries = collectEntries(
      group([printing()], {
        tcgplayer: {
          staged: [product],
          assigned: [product],
          assignments: [],
        },
      }),
    );
    expect(entries).toHaveLength(1);
  });

  it("sorts entries by marketplace, then language, set, reverse finish, and externalId", () => {
    const entries = collectEntries(
      group([printing()], {
        tcgplayer: {
          staged: [
            staged({ externalId: 11, language: "EN", groupName: "Alpha", finish: "normal" }),
            staged({ externalId: 10, language: "EN", groupName: "Alpha", finish: "foil" }),
            staged({ externalId: 12, language: "EN", groupName: "Alpha", finish: "normal" }),
            staged({ externalId: 13, language: "EN", groupName: "Beta", finish: "normal" }),
            staged({ externalId: 14, language: "SC", groupName: "Alpha", finish: "normal" }),
          ],
          assigned: [],
          assignments: [],
        },
        cardmarket: {
          staged: [staged({ externalId: 99, language: "EN", groupName: "Zeta", finish: "normal" })],
          assigned: [],
          assignments: [],
        },
      }),
    );
    expect(
      entries.map(
        (e) =>
          `${e.marketplace}:${e.product.language}:${e.product.groupName}:${e.product.finish}:${e.product.externalId}`,
      ),
    ).toEqual([
      "cardmarket:EN:Zeta:normal:99",
      "tcgplayer:EN:Alpha:normal:11",
      "tcgplayer:EN:Alpha:normal:12",
      "tcgplayer:EN:Alpha:foil:10",
      "tcgplayer:EN:Beta:normal:13",
      "tcgplayer:SC:Alpha:normal:14",
    ]);
  });

  it("hides the Cardmarket placeholder language so non-EN products don't falsely render as EN", () => {
    expect(displayedProductLanguage("cardmarket", "EN")).toBeNull();
    expect(displayedProductLanguage("cardmarket", "SC")).toBeNull();
    expect(displayedProductLanguage("tcgplayer", "EN")).toBe("EN");
    expect(displayedProductLanguage("cardtrader", "SC")).toBe("SC");
    expect(displayedProductLanguage("cardtrader", "")).toBeNull();
  });

  it("populates otherAssignedPrintingIds with printings assigned to a different external ID in the same marketplace", () => {
    const pNormal = printing({ printingId: "p-normal", finish: "normal" });
    const pFoil = printing({ printingId: "p-foil", finish: "foil" });
    const entries = collectEntries(
      group([pNormal, pFoil], {
        cardtrader: {
          staged: [],
          assigned: [
            staged({ externalId: 1, finish: "normal" }),
            staged({ externalId: 2, finish: "foil" }),
          ],
          assignments: [
            { externalId: 1, printingId: "p-normal", finish: "normal", language: "EN" },
            { externalId: 2, printingId: "p-foil", finish: "foil", language: "EN" },
          ],
        },
      }),
    );
    const one = entries.find((e) => e.product.externalId === 1);
    const two = entries.find((e) => e.product.externalId === 2);
    expect([...(one?.otherAssignedPrintingIds ?? [])]).toEqual(["p-foil"]);
    expect([...(two?.otherAssignedPrintingIds ?? [])]).toEqual(["p-normal"]);
    expect(one?.otherAssignedPrintingIds.has("p-normal")).toBe(false);
    expect(two?.otherAssignedPrintingIds.has("p-foil")).toBe(false);
  });

  it("skips assignment entries whose printingId is not in group.printings", () => {
    const entries = collectEntries(
      group([printing({ printingId: "p-known" })], {
        cardtrader: {
          staged: [],
          assigned: [staged({ externalId: 9 })],
          assignments: [
            { externalId: 9, printingId: "p-missing", finish: "normal", language: "EN" },
          ],
        },
      }),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]!.assignedPrintings).toEqual([]);
  });
});
