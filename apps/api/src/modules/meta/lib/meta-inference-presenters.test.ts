import type { PublicDeckCardResponse } from "@openrift/shared/types/api/deck";
import { describe, expect, it } from "vitest";

import type {
  DeckInferenceRow,
  InferenceNeighbourRow,
  ListShapeRow,
} from "../repositories/meta-inferences.js";
import {
  guessedCardRows,
  toMetaDeckInference,
  toMetaListShape,
} from "./meta-inference-presenters.js";

function card(cardId: string, zone: string, quantity = 1): PublicDeckCardResponse {
  return {
    cardId,
    zone: zone as PublicDeckCardResponse["zone"],
    quantity,
    preferredPrintingId: null,
    cardName: cardId,
    cardSlug: cardId,
    cardType: "unit",
    cardTypes: ["unit"],
    superTypes: [],
    domains: [],
    tags: [],
    keywords: [],
    maxCopiesOverride: null,
    additionalLegendCount: null,
    banned: false,
    energy: null,
    might: null,
    power: null,
    resolvedPrintingId: null,
    shortCode: null,
    imageId: null,
  };
}

function neighbour(zone: "champion" | "battlefield", shareToken: string): InferenceNeighbourRow {
  return {
    zone,
    shared: 30,
    shareToken,
    playerName: "Player",
    eventName: "Summoner Skirmish",
    rank: 1,
    rankIsTier: false,
    wins: 5,
    losses: 0,
    draws: null,
    championCardId: "yi",
    championName: "Master Yi, Honed",
    battlefieldNames: [],
  };
}

const ROW: DeckInferenceRow = {
  championCardId: "yi",
  championAltCardId: "yi-alt",
  championUnsure: true,
  battlefieldCardId: "dais",
  battlefieldAlsoCardIds: ["spring", "seat"],
  neighbours: [neighbour("champion", "c1"), neighbour("battlefield", "b1")],
};

const GUESSED = [card("yi", "champion"), card("yi-alt", "champion"), card("dais", "battlefield")];
const ALSO = [
  { cardId: "spring", name: "Star Spring", slug: "star-spring" },
  { cardId: "seat", name: "Seat of Power", slug: "seat-of-power" },
];

describe("guessedCardRows", () => {
  it("lists champions best first, then the battlefield", () => {
    expect(guessedCardRows(ROW).map((row) => [row.cardId, row.zone])).toEqual([
      ["yi", "champion"],
      ["yi-alt", "champion"],
      ["dais", "battlefield"],
    ]);
  });

  it("skips empty guesses", () => {
    expect(
      guessedCardRows({ ...ROW, championCardId: null, championAltCardId: null }).map(
        (row) => row.cardId,
      ),
    ).toEqual(["dais"]);
  });
});

describe("toMetaDeckInference", () => {
  it("serves every guess for an open list, the also-seen battlefields by name", () => {
    const inference = toMetaDeckInference(ROW, [], GUESSED, ALSO, "constructed");

    expect(inference?.champions.map((entry) => entry.cardId)).toEqual(["yi", "yi-alt"]);
    expect(inference?.battlefield?.cardId).toBe("dais");
    expect(inference?.alsoSeenBattlefields.map((entry) => entry.name)).toEqual([
      "Seat of Power",
      "Star Spring",
    ]);
    expect(inference?.championNeighbours.map((entry) => entry.shareToken)).toEqual(["c1"]);
    expect(inference?.battlefieldNeighbours.map((entry) => entry.shareToken)).toEqual(["b1"]);
  });

  it("drops the champion guess once the list names one", () => {
    const inference = toMetaDeckInference(
      ROW,
      [card("other", "champion")],
      GUESSED,
      ALSO,
      "constructed",
    );

    expect(inference?.champions).toEqual([]);
    expect(inference?.championNeighbours).toEqual([]);
    expect(inference?.battlefield?.cardId).toBe("dais");
  });

  it("drops the battlefield guess when the list already holds that card", () => {
    const inference = toMetaDeckInference(
      ROW,
      [card("dais", "battlefield")],
      GUESSED,
      ALSO,
      "constructed",
    );

    expect(inference?.battlefield).toBeNull();
    expect(inference?.alsoSeenBattlefields).toEqual([]);
  });

  it("marks a single champion unsure when the job did", () => {
    const inference = toMetaDeckInference(
      { ...ROW, championAltCardId: null },
      [],
      GUESSED.filter((entry) => entry.cardId !== "yi-alt"),
      ALSO,
      "constructed",
    );

    expect(inference?.champions).toHaveLength(1);
    expect(inference?.championUnsure).toBe(true);
  });

  it("is sure about a single champion the job was sure about", () => {
    const inference = toMetaDeckInference(
      { ...ROW, championAltCardId: null, championUnsure: false },
      [],
      GUESSED.filter((entry) => entry.cardId !== "yi-alt"),
      ALSO,
      "constructed",
    );

    expect(inference?.championUnsure).toBe(false);
  });

  it("is null when every zone has filled", () => {
    const cards = [
      card("other", "champion"),
      card("a", "battlefield"),
      card("b", "battlefield"),
      card("c", "battlefield"),
    ];

    expect(toMetaDeckInference(ROW, cards, GUESSED, ALSO, "constructed")).toBeNull();
  });
});

describe("toMetaListShape", () => {
  const shape: ListShapeRow = {
    deckId: "deck-1",
    format: "constructed",
    legend: 1,
    champion: 0,
    battlefield: 1,
    main: 39,
    runes: 12,
    battlefieldCardIds: ["dais"],
    guessedChampionCardId: "yi",
    guessedChampionName: "Master Yi, Honed",
    guessedChampionAltName: null,
    guessedBattlefieldCardId: "seat",
  };

  it("flags both guesses while their zones are open", () => {
    expect(toMetaListShape(shape)).toMatchObject({
      battlefield: 1,
      inferredChampion: true,
      inferredBattlefield: true,
    });
  });

  it("drops a guess the list has since filled or already holds", () => {
    expect(toMetaListShape({ ...shape, champion: 1, battlefieldCardIds: ["seat"] })).toMatchObject({
      inferredChampion: false,
      inferredBattlefield: false,
    });
    expect(toMetaListShape({ ...shape, battlefield: 3 }).inferredBattlefield).toBe(false);
  });
});
