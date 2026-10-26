import { describe, expect, it } from "vitest";

import {
  toDistributionChannel,
  toEnumRows,
  toKeywordEntries,
  toTagCategoryMap,
} from "./reference-presenters.js";

const shield = {
  name: "Shield",
  color: "#4488ff",
  darkText: false,
  costKeyword: false,
  cardModifier: true,
};

describe("toKeywordEntries", () => {
  it("keys entries by name", () => {
    expect(toKeywordEntries([shield], [])).toEqual({
      Shield: { color: "#4488ff", darkText: false, costKeyword: false, cardModifier: true },
    });
  });

  it("attaches translations by language", () => {
    const entries = toKeywordEntries(
      [shield],
      [
        { keywordName: "Shield", language: "FR", label: "Bouclier" },
        { keywordName: "Shield", language: "KR", label: "보호막" },
      ],
    );
    expect(entries.Shield?.translations).toEqual({ FR: "Bouclier", KR: "보호막" });
  });

  it("drops a translation of an unknown keyword", () => {
    const entries = toKeywordEntries(
      [shield],
      [{ keywordName: "Burn", language: "FR", label: "Brûlure" }],
    );
    expect(Object.keys(entries)).toEqual(["Shield"]);
  });
});

describe("toEnumRows", () => {
  it("keeps only slug, label and sort order", () => {
    const row = { slug: "fury", label: "Fury", sortOrder: 0, color: "#b32117", isWellKnown: true };
    expect(toEnumRows([row])).toEqual([{ slug: "fury", label: "Fury", sortOrder: 0 }]);
  });
});

describe("toDistributionChannel", () => {
  it("keeps the public channel fields", () => {
    const row = {
      id: "ch-1",
      slug: "nexus-night",
      label: "Nexus Night",
      description: null,
      kind: "event",
      parentId: null,
      childrenLabel: "Season",
      sortOrder: 3,
      createdAt: new Date(),
    };
    expect(toDistributionChannel(row)).toEqual({
      id: "ch-1",
      slug: "nexus-night",
      label: "Nexus Night",
      description: null,
      kind: "event",
      parentId: null,
      childrenLabel: "Season",
    });
  });
});

describe("toTagCategoryMap", () => {
  it("maps each tag to its category slug", () => {
    expect(
      toTagCategoryMap([
        { tag: "Ionia", category: "region" },
        { tag: "Ahri", category: "legend" },
      ]),
    ).toEqual({ Ionia: "region", Ahri: "legend" });
  });
});
