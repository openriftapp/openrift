import type { PublicDeckCardResponse } from "@openrift/shared/types/api/deck";
import { describe, expect, it } from "vitest";

import { archivedDeckIdentity } from "./meta-deck-identity";

function card(overrides: Partial<PublicDeckCardResponse> = {}): PublicDeckCardResponse {
  return {
    cardId: "card-1",
    zone: "main",
    quantity: 1,
    preferredPrintingId: null,
    cardName: "Punch First",
    cardSlug: "punch-first",
    cardType: "spell",
    cardTypes: ["spell"],
    superTypes: [],
    domains: ["fury"],
    tags: [],
    keywords: [],
    maxCopiesOverride: null,
    banned: false,
    energy: 1,
    might: null,
    power: null,
    resolvedPrintingId: null,
    shortCode: null,
    imageId: null,
    ...overrides,
  } as PublicDeckCardResponse;
}

const legend = card({
  cardId: "legend-1",
  zone: "legend",
  cardName: "Relentless Storm",
  cardSlug: "relentless-storm",
  cardType: "legend",
  cardTypes: ["legend"],
  tags: ["Volibear"],
  domains: ["fury", "body"],
});

describe("archivedDeckIdentity", () => {
  it("names the legend champion-first with its slug and domains", () => {
    expect(archivedDeckIdentity([legend, card()])).toEqual({
      cardId: "legend-1",
      name: "Volibear, Relentless Storm",
      slug: "relentless-storm",
      domains: ["fury", "body"],
    });
  });

  it("falls back to the chosen champion when the legend was never published", () => {
    const champion = card({
      cardId: "champ-1",
      zone: "champion",
      cardName: "Volibear, Thunder's Roar",
      cardSlug: "volibear-thunders-roar",
      cardType: "unit",
      cardTypes: ["unit"],
      tags: ["Volibear"],
    });
    expect(archivedDeckIdentity([champion, card()])?.name).toBe("Volibear, Thunder's Roar");
  });

  it("returns null when neither identity zone holds a card", () => {
    expect(archivedDeckIdentity([card()])).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(archivedDeckIdentity([])).toBeNull();
  });
});
