import type { SearchableCard } from "@openrift/shared/card-search";
import { buildCardIndex } from "@openrift/shared/card-search";
import { describe, expect, it } from "vitest";

import { closestCard, slugToSearchText } from "./closest-card";

const cards: SearchableCard[] = [
  { id: "c1", slug: "blazing-scorcher", name: "Blazing Scorcher" },
  { id: "c2", slug: "jinx-rebel", name: "Jinx, Rebel" },
  { id: "c3", slug: "jinx-loose-cannon", name: "Jinx, Loose Cannon" },
  { id: "c4", slug: "viktor", name: "Viktor" },
  { id: "c5", slug: "dorans-shield", name: "Doran’s Shield" },
];

const index = buildCardIndex(cards, new Map());

function closestSlug(slug: string): string | undefined {
  return closestCard(index, slugToSearchText(slug))?.slug;
}

describe("slugToSearchText", () => {
  it("turns slug separators into spaces", () => {
    expect(slugToSearchText("blazing-scorcherr")).toBe("blazing scorcherr");
  });

  it("collapses repeated separators and trims the ends", () => {
    expect(slugToSearchText("-jinx--rebel_")).toBe("jinx rebel");
  });

  it("decodes percent-encoded characters", () => {
    expect(slugToSearchText("doran%E2%80%99s-shield")).toBe("doran’s shield");
  });

  it("keeps a malformed percent sequence as typed", () => {
    expect(slugToSearchText("viktor%E2")).toBe("viktor%E2");
  });

  it("returns an empty string for an empty slug", () => {
    expect(slugToSearchText("")).toBe("");
  });
});

describe("closestCard", () => {
  it("finds the card whose name starts with the slug", () => {
    expect(closestSlug("blazing-scorch")).toBe("blazing-scorcher");
  });

  it("finds the card behind a one-letter typo", () => {
    expect(closestSlug("blazing-scorcherr")).toBe("blazing-scorcher");
    expect(closestSlug("blazing-scorchr")).toBe("blazing-scorcher");
    expect(closestSlug("viktro")).toBe("viktor");
  });

  it("matches a name with punctuation the slug drops", () => {
    expect(closestSlug("dorans-shield")).toBe("dorans-shield");
  });

  it("suggests nothing when no name is close", () => {
    expect(closestSlug("summoner-skirmish")).toBeUndefined();
  });

  it("suggests nothing for an empty slug", () => {
    expect(closestSlug("")).toBeUndefined();
  });

  it("suggests nothing for a slug too short to mean one card", () => {
    expect(closestSlug("ji")).toBeUndefined();
  });

  it("suggests nothing when two cards fit equally well", () => {
    expect(closestSlug("jinx")).toBeUndefined();
  });

  it("finds a typo of the card's slug when the stored name reads differently", () => {
    const renamed = buildCardIndex(
      [{ id: "a", slug: "ahri-alluring", name: "Alluring Ahri" }],
      new Map(),
    );
    expect(closestCard(renamed, slugToSearchText("ahri-alluting"))?.id).toBe("a");
  });

  it("suggests nothing when two names are each one typo away", () => {
    const twins = buildCardIndex(
      [
        { id: "a", slug: "ember-hound", name: "Ember Hound" },
        { id: "b", slug: "ember-mound", name: "Ember Mound" },
      ],
      new Map(),
    );
    expect(closestCard(twins, "ember bound")).toBeUndefined();
  });
});
