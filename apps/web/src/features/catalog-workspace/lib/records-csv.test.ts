import type { WorkspaceRecordRow } from "@openrift/shared/contracts/admin/catalog-workspace";
import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";
import { describe, expect, it } from "vitest";

import { buildCardsCsv, buildFacesCsv, buildPrintingsCsv, recordsCsvFilename } from "./records-csv";

function row(overrides: Partial<WorkspaceRecordRow> = {}): WorkspaceRecordRow {
  return {
    id: "p1",
    cardSlug: "jinx-loose-cannon",
    cardName: "Jinx, Loose Cannon",
    setName: "Origins",
    shortCode: "OGN-030",
    language: "en",
    finish: "foil",
    imageUrl: null,
    updatedAt: "2026-10-20T10:00:00.000Z",
    ...overrides,
  };
}

function card(overrides: Partial<CandidateCardSummaryResponse> = {}): CandidateCardSummaryResponse {
  return {
    cardSlug: "ahri-alluring",
    name: "Ahri, Alluring",
    normalizedName: "ahri alluring",
    shortCodes: ["OGN-066", "OGN-066a"],
    stagingShortCodes: [],
    setSlugs: ["origins"],
    candidateCount: 1,
    uncheckedCardCount: 1,
    uncheckedPrintingCount: 2,
    unlinkedPrintingCount: 0,
    unlinkedTrustedPrintingCount: 0,
    hasFavorite: false,
    favoriteStagingShortCodes: [],
    suggestedCardSlug: null,
    hasUserSubmission: false,
    pendingSubmissions: 1,
    uncheckedTrustedProviders: [],
    updatedAt: "2026-10-20T10:00:00.000Z",
    ...overrides,
  };
}

function body(csv: string): string {
  return csv.slice(csv.indexOf("\n") + 1);
}

describe("buildCardsCsv", () => {
  it("writes a header and one line per card", () => {
    const csv = buildCardsCsv([card()]);
    expect(csv.split("\n")[0]).toBe(
      "Card,Card slug,Draft,First set,Printings,Open from sources,Proposals,Updated",
    );
    expect(body(csv)).toBe(
      '"Ahri, Alluring",ahri-alluring,no,origins,2,3,1,2026-10-20T10:00:00.000Z',
    );
  });

  it("counts staged codes for a draft", () => {
    const csv = buildCardsCsv([
      card({ cardSlug: null, name: "Bird", stagingShortCodes: ["UNL-T02"] }),
    ]);
    expect(body(csv)).toBe("Bird,,yes,origins,1,3,1,2026-10-20T10:00:00.000Z");
  });
});

describe("buildPrintingsCsv", () => {
  it("leaves fields the row does not carry empty", () => {
    expect(body(buildPrintingsCsv([row()]))).toBe(
      '"Jinx, Loose Cannon",jinx-loose-cannon,OGN-030,,Origins,en,foil,,,,,,,2026-10-20T10:00:00.000Z',
    );
  });

  it("joins markers and escapes quotes and line breaks", () => {
    const csv = buildPrintingsCsv([
      row({
        cardName: 'The "Bird"',
        markers: ["promo", "stamped"],
        channelLabel: "Organized play › Skirmish\nRegional",
        status: "announced",
        isDoubleSided: true,
        imageCount: 3,
        isPromo: true,
        publicCode: "OGN-030p",
      }),
    ]);
    expect(body(csv)).toBe(
      '"The ""Bird""",jinx-loose-cannon,OGN-030,OGN-030p,Origins,en,foil,promo; stamped,"Organized play › Skirmish\nRegional",announced,yes,3,yes,2026-10-20T10:00:00.000Z',
    );
  });
});

describe("buildFacesCsv", () => {
  it("writes the face columns", () => {
    const csv = buildFacesCsv([
      row({
        rarity: "epic",
        artVariant: "altart",
        artist: "Kudos Productions",
        imageState: "substitute",
        printingCount: 2,
      }),
    ]);
    expect(body(csv)).toBe(
      '"Jinx, Loose Cannon",jinx-loose-cannon,OGN-030,Origins,en,foil,epic,altart,Kudos Productions,substitute,2,2026-10-20T10:00:00.000Z',
    );
  });

  it("writes only the header for no rows", () => {
    expect(buildFacesCsv([]).split("\n")).toHaveLength(1);
  });
});

describe("recordsCsvFilename", () => {
  it("names the table and the day", () => {
    expect(recordsCsvFilename("faces", "2026-10-26")).toBe("catalog-faces-2026-10-26.csv");
  });
});
