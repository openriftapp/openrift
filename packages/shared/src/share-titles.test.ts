import { describe, expect, it } from "vitest";

import {
  boardShareDescription,
  collectionShareDescription,
  collectionShareTitle,
  deckShareDescription,
  deckShareTitle,
  listIntentLabelEnglish,
  listShareDescription,
  listShareTitle,
  tierListShareDescription,
  tierListShareTitle,
  userBundleShareDescription,
  userBundleShareTitle,
} from "./share-titles.js";

describe("listIntentLabelEnglish", () => {
  it("uses the product words for each intent", () => {
    expect(listIntentLabelEnglish("wish")).toBe("Wishlist");
    expect(listIntentLabelEnglish("trade")).toBe("Tradelist");
    expect(listIntentLabelEnglish("organize")).toBe("List");
  });
});

describe("deck share copy", () => {
  it("puts the format label in the title", () => {
    expect(deckShareTitle("Azir Control", "Custom Region")).toBe(
      "Azir Control (Custom Region deck)",
    );
  });

  it("names the owner when there is one", () => {
    expect(deckShareDescription("Constructed", "Ashe")).toBe(
      "A Constructed Riftbound deck shared by Ashe.",
    );
  });

  it("omits the byline without an owner name", () => {
    expect(deckShareDescription("Constructed", null)).toBe("A Constructed Riftbound deck.");
    expect(deckShareDescription("Constructed", "")).toBe("A Constructed Riftbound deck.");
  });
});

describe("list share copy", () => {
  it("titles each intent with its product word, never the raw intent", () => {
    expect(listShareTitle("Wants", "wish")).toBe("Wants (Wishlist)");
    expect(listShareTitle("Haves", "trade")).toBe("Haves (Tradelist)");
    expect(listShareTitle("Binder", "organize")).toBe("Binder (List)");
  });

  it("describes the list with and without an owner", () => {
    expect(listShareDescription("trade", "Braum")).toBe("A Riftbound tradelist shared by Braum.");
    expect(listShareDescription("organize", undefined)).toBe("A Riftbound list.");
  });
});

describe("collection, tier list and board copy", () => {
  it("omits the byline without an owner name", () => {
    expect(collectionShareTitle("Main binder")).toBe("Main binder (collection)");
    expect(collectionShareDescription(null)).toBe("A Riftbound card collection.");
    expect(collectionShareDescription("Lux")).toBe("A Riftbound card collection shared by Lux.");
    expect(tierListShareTitle("Spiritforged picks")).toBe("Spiritforged picks (tier list)");
    expect(tierListShareDescription(null, 1)).toBe("A Riftbound tier list, ranking 1 card.");
    expect(tierListShareDescription("Lux", 12)).toBe(
      "A Riftbound tier list by Lux, ranking 12 cards.",
    );
    expect(boardShareDescription(null)).toBe("A Riftbound board state.");
    expect(boardShareDescription("Jinx")).toBe("A Riftbound board state by Jinx.");
  });
});

describe("user bundle copy", () => {
  it("titles the bundle with or without a name", () => {
    expect(userBundleShareTitle("Teemo")).toBe("Teemo's wishlists and tradelists");
    expect(userBundleShareTitle(null)).toBe("Wishlists and tradelists");
  });

  it("counts lists and cards with plurals", () => {
    expect(userBundleShareDescription(1, 2, 1)).toBe("1 wishlist, 2 tradelists, 1 card in total.");
  });
});
