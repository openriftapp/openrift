import { describe, expect, it } from "vitest";

import { authDestination, authDestinationKey } from "./auth-destination";

describe("authDestinationKey", () => {
  it.each([
    ["/collections", "collections"],
    ["/collections/0190a1b2-c3d4", "collections"],
    ["/collections/lists/abc?view=grid", "collections"],
    ["/scan", "scan"],
    ["/scan/report", "scan"],
    ["/groups", "groups"],
    ["/groups/summoner-skirmish/members", "groups"],
    ["/trades", "trades"],
    ["/trades/buy", "trades"],
    ["/loans", "loans"],
    ["/tournaments", "tournaments"],
    ["/tournaments?tab=past", "tournaments"],
    ["/tournaments/new", "tournaments"],
    ["/tier-lists", "tierLists"],
    ["/tier-lists/0190a1b2-c3d4", "tierLists"],
    ["/contribute", "contribute"],
    ["/contribute/fix#top", "contribute"],
  ])("maps %s to %s", (redirect, key) => {
    expect(authDestinationKey(redirect)).toBe(key);
  });

  it.each([
    ["no redirect", undefined],
    ["an empty redirect", ""],
    ["the home page", "/"],
    ["a public page", "/meta/decks?legend=jinx"],
    ["a deck", "/decks/compare"],
    ["a shared collection", "/collections/share/abc"],
    ["a shared tier list", "/tier-lists/share/abc"],
    ["a group join link", "/groups/join?code=abc"],
    ["one tournament", "/tournaments/0190a1b2-c3d4"],
    ["a tournament report link", "/tournaments/report/abc"],
    ["a path that only starts like a destination", "/collectionsx"],
  ])("keeps the default for %s", (_label, redirect) => {
    expect(authDestinationKey(redirect)).toBeUndefined();
  });
});

describe("authDestination", () => {
  it("returns the label, title and three perks for a known destination", () => {
    const destination = authDestination("/collections");
    expect(destination?.label).toBe("Collection");
    expect(destination?.title).toBe("Sign in to open your collection");
    expect(destination?.perks).toHaveLength(3);
  });

  it("returns undefined for an unknown destination", () => {
    expect(authDestination("/cards")).toBeUndefined();
  });
});
