import type { PublicDeckCardResponse } from "@openrift/shared/types/api/deck";
import type { MetaDeckInference, MetaListShape } from "@openrift/shared/types/api/meta";
import { describe, expect, it } from "vitest";

import {
  describeListShape,
  inferredCards,
  inferredCopyNames,
  inferredCopyOptions,
  inferredSummary,
  listShapeSegments,
} from "./meta-inferred";

function card(overrides: Partial<PublicDeckCardResponse> = {}): PublicDeckCardResponse {
  return {
    cardId: "card-1",
    zone: "champion",
    quantity: 1,
    preferredPrintingId: null,
    cardName: "Master Yi, Honed",
    cardSlug: "master-yi-honed",
    cardType: "unit",
    cardTypes: ["unit"],
    superTypes: ["champion"],
    domains: ["calm"],
    tags: ["Master Yi"],
    keywords: [],
    maxCopiesOverride: null,
    additionalLegendCount: null,
    banned: false,
    energy: 3,
    might: 3,
    power: null,
    resolvedPrintingId: null,
    shortCode: null,
    imageId: null,
    ...overrides,
  };
}

function inference(overrides: Partial<MetaDeckInference> = {}): MetaDeckInference {
  return {
    champions: [card(), card({ cardId: "card-2", cardName: "Master Yi, Tempered" })],
    championUnsure: true,
    battlefield: card({ cardId: "bf-1", zone: "battlefield", cardName: "Seat of Power" }),
    alsoSeenBattlefields: [],
    championNeighbours: [],
    battlefieldNeighbours: [],
    ...overrides,
  };
}

const SHAPE: MetaListShape = {
  format: "constructed",
  legend: 1,
  champion: 0,
  battlefield: 0,
  main: 39,
  runes: 12,
  inferredChampion: true,
  inferredBattlefield: true,
};

describe("inferredCards", () => {
  it("lists every champion candidate, then the battlefield", () => {
    expect(inferredCards(inference()).map((entry) => entry.cardId)).toEqual([
      "card-1",
      "card-2",
      "bf-1",
    ]);
  });

  it("lists nothing without a guess", () => {
    expect(inferredCards(null)).toEqual([]);
  });
});

describe("inferredSummary", () => {
  it("reads an unsure pair as either one", () => {
    expect(inferredSummary(inference())).toBe(
      "Master Yi, Honed or Master Yi, Tempered and Seat of Power",
    );
  });
});

describe("inferredCopyOptions", () => {
  it("offers one copy per champion of an unsure guess, titled by the champion", () => {
    expect(
      inferredCopyOptions(inference()).map((option) => [
        option.label,
        option.cards.map((entry) => entry.cardId),
      ]),
    ).toEqual([
      ["With Master Yi, Honed", ["card-1", "bf-1"]],
      ["With Master Yi, Tempered", ["card-2", "bf-1"]],
    ]);
  });

  it("titles a sure guess by what it fills", () => {
    const [both] = inferredCopyOptions(inference({ champions: [card()], championUnsure: false }));
    expect(both?.label).toBe("With inferred champion and battlefield");
    expect(both?.description).toBe("Adds Master Yi, Honed and Seat of Power.");

    const [championOnly] = inferredCopyOptions(
      inference({ champions: [card()], championUnsure: false, battlefield: null }),
    );
    expect(championOnly?.label).toBe("With inferred champion");
  });

  it("offers the battlefield alone when no champion is guessed", () => {
    const options = inferredCopyOptions(inference({ champions: [] }));
    expect(
      options.map((option) => [option.label, option.cards.map((entry) => entry.cardId)]),
    ).toEqual([["With inferred battlefield", ["bf-1"]]]);
  });

  it("offers nothing without a guess", () => {
    expect(inferredCopyOptions(null)).toEqual([]);
    expect(inferredCopyOptions(inference({ champions: [], battlefield: null }))).toEqual([]);
  });
});

describe("inferredCopyNames", () => {
  it("joins the names the way the archive writes lists", () => {
    expect(inferredCopyNames([card(), inference().battlefield!])).toBe(
      "Master Yi, Honed and Seat of Power",
    );
  });
});

describe("listShapeSegments", () => {
  it("draws legend, champion, three battlefields, then main and runes", () => {
    const segments = listShapeSegments(SHAPE);

    expect(segments.map((segment) => [segment.zone, segment.state])).toEqual([
      ["legend", "known"],
      ["champion", "inferred"],
      ["battlefield", "inferred"],
      ["battlefield", "unknown"],
      ["battlefield", "unknown"],
      ["main", "known"],
      ["runes", "known"],
    ]);
  });

  it("puts a battlefield guess after the known ones", () => {
    const segments = listShapeSegments({ ...SHAPE, battlefield: 2 }).filter(
      (segment) => segment.zone === "battlefield",
    );

    expect(segments.map((segment) => segment.state)).toEqual(["known", "known", "inferred"]);
  });

  it("fills a partly known main deck by its share", () => {
    const main = listShapeSegments({ ...SHAPE, main: 30 }).find(
      (segment) => segment.zone === "main",
    );

    expect(main?.state).toBe("unknown");
    expect(main?.fill).toBeCloseTo(30 / 39);
  });
});

describe("describeListShape", () => {
  it("names what is known and what is guessed", () => {
    expect(describeListShape(SHAPE)).toBe(
      "The Chosen Champion and the battlefields are not known. Inferred: Chosen Champion and one battlefield.",
    );
  });

  it("leaves the guess sentence out when nothing is guessed", () => {
    expect(
      describeListShape({ ...SHAPE, inferredChampion: false, inferredBattlefield: false }),
    ).toBe("The Chosen Champion and the battlefields are not known.");
  });
});
