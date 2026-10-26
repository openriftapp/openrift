import type { Selectable } from "kysely";
import { describe, expect, it } from "vitest";

import type { CandidatePrintingsTable } from "../../../db/tables/candidates.js";
import type {
  PrintingProbeRow,
  TrustedDraftRow,
  TrustedNewPrintingRow,
} from "../repositories/workspace-batch.js";
import {
  acceptPrintingFieldsFrom,
  eligibleTrustedCards,
  findDuplicatePrinting,
  missingPrintingFields,
  nameHead,
  trustedPrintingGroups,
} from "./workspace-batch.js";

function cp(
  id: string,
  over: Partial<Selectable<CandidatePrintingsTable>> = {},
): Selectable<CandidatePrintingsTable> {
  return {
    id,
    candidateCardId: "cc-1",
    printingId: null,
    shortCode: "OGN-027",
    setId: "ogn",
    setName: "Origins",
    rarity: "rare",
    artVariant: null,
    isSigned: null,
    isOvernumbered: null,
    markerSlugs: [],
    distributionChannelSlugs: [],
    finish: "normal",
    size: null,
    artist: "Kudos Productions",
    publicCode: "OGN-027/298",
    printedRulesText: null,
    printedEffectText: null,
    imageUrl: null,
    imageFingerprint: null,
    imageFingerprintUrl: null,
    flavorText: null,
    externalId: id,
    extraData: null,
    language: "EN",
    printedName: null,
    printedYear: null,
    releasedAt: null,
    releasePrecision: null,
    announcedAt: null,
    checkedAt: null,
    uploadedAt: new Date("2026-10-20T00:00:00.000Z"),
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    updatedAt: new Date("2026-10-20T00:00:00.000Z"),
    ...over,
  };
}

function draft(id: string, over: Partial<TrustedDraftRow> = {}): TrustedDraftRow {
  return {
    id,
    provider: "gallery",
    normName: "poroherder",
    name: "Poro Herder",
    types: ["unit"],
    ...over,
  };
}

const LIVE = [{ id: "card-1", slug: "jinx-loose-cannon", name: "Jinx, Loose Cannon" }];

describe("nameHead", () => {
  it("keeps the part before the first comma", () => {
    expect(nameHead("Jinx, Rebel")).toBe("Jinx");
    expect(nameHead("Poro Herder")).toBe("Poro Herder");
  });
});

describe("missingPrintingFields", () => {
  it("lists the empty required fields", () => {
    expect(missingPrintingFields(cp("a"))).toEqual([]);
    expect(missingPrintingFields(cp("a", { setId: null, artist: "" }))).toEqual([
      "setId",
      "artist",
    ]);
  });
});

describe("eligibleTrustedCards", () => {
  it("returns a complete draft without a similar live card", () => {
    expect(eligibleTrustedCards([draft("cc-1")], [cp("p1")], LIVE)).toEqual([
      { normName: "poroherder", name: "Poro Herder" },
    ]);
  });

  it("drops a draft whose name head matches a live card", () => {
    const jinx = draft("cc-1", { normName: "jinxrebel", name: "Jinx, Rebel" });
    expect(eligibleTrustedCards([jinx], [cp("p1")], LIVE)).toEqual([]);
  });

  it("drops a draft without types", () => {
    expect(eligibleTrustedCards([draft("cc-1", { types: [] })], [cp("p1")], LIVE)).toEqual([]);
  });

  it("drops a draft without a complete printing", () => {
    expect(eligibleTrustedCards([draft("cc-1")], [cp("p1", { rarity: null })], LIVE)).toEqual([]);
    expect(eligibleTrustedCards([draft("cc-1")], [], LIVE)).toEqual([]);
  });

  it("judges types on the first provider and printings across all trusted sources", () => {
    const rows = [
      draft("cc-2", { provider: "zeta", types: [] }),
      draft("cc-1", { provider: "alpha" }),
    ];
    expect(eligibleTrustedCards(rows, [cp("p1", { candidateCardId: "cc-2" })], LIVE)).toHaveLength(
      1,
    );
    const typeless = [draft("cc-1", { provider: "alpha", types: [] }), draft("cc-2")];
    expect(eligibleTrustedCards(typeless, [cp("p1", { candidateCardId: "cc-2" })], LIVE)).toEqual(
      [],
    );
  });

  it("returns one entry per name, sorted", () => {
    const rows = [
      draft("cc-1"),
      draft("cc-2", { provider: "other" }),
      draft("cc-3", { normName: "blastcone", name: "Blast Cone" }),
    ];
    const printings = [cp("p1"), cp("p3", { candidateCardId: "cc-3" })];
    expect(eligibleTrustedCards(rows, printings, LIVE).map((entry) => entry.name)).toEqual([
      "Blast Cone",
      "Poro Herder",
    ]);
  });
});

function newRow(id: string, over: Partial<TrustedNewPrintingRow> = {}): TrustedNewPrintingRow {
  return {
    id,
    candidateCardId: "cc-1",
    provider: "gallery",
    cardId: "card-1",
    cardSlug: "jinx-loose-cannon",
    ...over,
  };
}

describe("trustedPrintingGroups", () => {
  it("groups by card and printing identity", () => {
    const printings = [
      cp("p1"),
      cp("p2", { candidateCardId: "cc-2" }),
      cp("p3", { finish: "foil" }),
      cp("p4", { language: "FR" }),
    ];
    const rows = [
      newRow("p1"),
      newRow("p2", { candidateCardId: "cc-2" }),
      newRow("p3"),
      newRow("p4"),
    ];
    const groups = trustedPrintingGroups(rows, printings);
    expect(groups.map((group) => [group.label, group.candidatePrintingIds])).toEqual([
      ["OGN-027 normal EN", ["p1", "p2"]],
      ["OGN-027 foil EN", ["p3"]],
      ["OGN-027 normal FR", ["p4"]],
    ]);
  });

  it("skips rows without a loaded candidate printing", () => {
    expect(trustedPrintingGroups([newRow("missing")], [])).toEqual([]);
  });
});

function probe(over: Partial<PrintingProbeRow> = {}): PrintingProbeRow {
  return {
    printingId: "pr-1",
    cardId: "card-1",
    shortCode: "OGN-027",
    language: "EN",
    distributionChannelSlugs: [],
    ...over,
  };
}

describe("findDuplicatePrinting", () => {
  const [group] = trustedPrintingGroups(
    [newRow("p1")],
    [cp("p1", { shortCode: "OGN-027a", distributionChannelSlugs: ["store-event"] })],
  );

  it("hits a printing with the same card, stem, language and channels", () => {
    expect(
      findDuplicatePrinting(group!, [probe({ distributionChannelSlugs: ["store-event"] })]),
    ).toMatchObject({ printingId: "pr-1" });
  });

  it("misses other channels, languages and cards", () => {
    expect(
      findDuplicatePrinting(group!, [
        probe(),
        probe({ language: "FR", distributionChannelSlugs: ["store-event"] }),
        probe({ cardId: "card-2", distributionChannelSlugs: ["store-event"] }),
        probe({ shortCode: "OGN-028", distributionChannelSlugs: ["store-event"] }),
      ]),
    ).toBeUndefined();
  });
});

describe("acceptPrintingFieldsFrom", () => {
  it("fills defaults for missing optional fields", () => {
    expect(acceptPrintingFieldsFrom(cp("p1", { language: null }))).toMatchObject({
      shortCode: "OGN-027",
      setId: "ogn",
      artVariant: "normal",
      isSigned: false,
      size: "standard",
      language: "EN",
    });
  });
});
