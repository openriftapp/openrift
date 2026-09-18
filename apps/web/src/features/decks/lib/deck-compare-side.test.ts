import { describe, expect, it, vi } from "vitest";

import { compareLinkParam, parseCompareSide, queryDeckLink } from "./deck-compare-side";

vi.mock("@/features/decks/lib/decks-queries", () => ({
  publicDeckQueryOptions: (token: string) => ({ queryKey: ["share", token] }),
}));

vi.mock("@/features/meta/lib/meta-queries", () => ({
  metaDeckQueryOptions: (token: string) => ({ queryKey: ["meta", token] }),
}));

describe("parseCompareSide", () => {
  it("returns null for a missing or empty side", () => {
    expect(parseCompareSide()).toBeNull();
    expect(parseCompareSide("")).toBeNull();
  });

  it("reads a bare value as a deck id, local ones included", () => {
    expect(parseCompareSide("0199b1c2-aaaa-7bbb-8ccc-123456789abc")).toEqual({
      kind: "deck",
      deckId: "0199b1c2-aaaa-7bbb-8ccc-123456789abc",
    });
    expect(parseCompareSide("local:abc")).toEqual({ kind: "deck", deckId: "local:abc" });
  });

  it("reads meta and share links", () => {
    expect(parseCompareSide("meta:eFHFCGDrFNr4")).toEqual({ kind: "meta", token: "eFHFCGDrFNr4" });
    expect(parseCompareSide("share:Abc123Xyz456")).toEqual({
      kind: "share",
      token: "Abc123Xyz456",
    });
  });

  it("round-trips the params it builds", () => {
    expect(parseCompareSide(compareLinkParam("meta", "eFHFCGDrFNr4"))).toEqual({
      kind: "meta",
      token: "eFHFCGDrFNr4",
    });
  });

  it("does not read a malformed token as a link", () => {
    expect(parseCompareSide("meta:ab")).toEqual({ kind: "deck", deckId: "meta:ab" });
    expect(parseCompareSide("share:a/b-cdefg")).toEqual({
      kind: "deck",
      deckId: "share:a/b-cdefg",
    });
  });
});

describe("queryDeckLink", () => {
  it("reads each link kind through its own query", async () => {
    const query = vi.fn().mockResolvedValue({ cards: [] });
    const queryClient = { query } as unknown as Parameters<typeof queryDeckLink>[0];

    await queryDeckLink(queryClient, "meta", "eFHFCGDrFNr4");
    await queryDeckLink(queryClient, "share", "Abc123Xyz456");

    expect(query.mock.calls).toEqual([
      [{ queryKey: ["meta", "eFHFCGDrFNr4"] }],
      [{ queryKey: ["share", "Abc123Xyz456"] }],
    ]);
  });
});
