import { describe, expect, it } from "vitest";

import { cardPath, deckImportPath, groupPath, rulesPath } from "./site-paths.js";

describe("cardPath", () => {
  it("builds the card path", () => {
    expect(cardPath("OGN-001")).toBe("/cards/OGN-001");
  });

  it("encodes the slug once", () => {
    expect(cardPath("a b/c")).toBe("/cards/a%20b%2Fc");
  });
});

describe("groupPath", () => {
  it("builds the group path with an optional section", () => {
    expect(groupPath("friends")).toBe("/groups/friends");
    expect(groupPath("friends", "trades")).toBe("/groups/friends/trades");
  });

  it("encodes the slug", () => {
    expect(groupPath("a/b")).toBe("/groups/a%2Fb");
  });
});

describe("deckImportPath", () => {
  it("omits the query without a code", () => {
    expect(deckImportPath()).toBe("/decks/import");
  });

  it("encodes the code", () => {
    expect(deckImportPath("A B&C")).toBe("/decks/import?code=A%20B%26C");
  });
});

describe("rulesPath", () => {
  it("builds kind, version and language segments", () => {
    expect(rulesPath("core")).toBe("/rules/core");
    expect(rulesPath("core", 3)).toBe("/rules/core/3");
    expect(rulesPath("tournament", "2026-01", "en")).toBe("/rules/tournament/2026-01?lang=en");
  });

  it("supports a language without a version", () => {
    expect(rulesPath("core", undefined, "fr")).toBe("/rules/core?lang=fr");
  });
});
