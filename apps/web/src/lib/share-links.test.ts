import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/site-config", () => ({
  getSiteUrl: () => "https://openrift.test",
}));

const { shareLinkUrl } = await import("./share-links");

describe("shareLinkUrl", () => {
  it("builds the public URL for each shared surface", () => {
    expect(shareLinkUrl("list", { shareToken: "tok", isPublic: true })).toBe(
      "https://openrift.test/lists/share/tok",
    );
    expect(shareLinkUrl("collection", { shareToken: "tok", isPublic: true })).toBe(
      "https://openrift.test/collections/share/tok",
    );
    expect(shareLinkUrl("deck", { shareToken: "tok", isPublic: true })).toBe(
      "https://openrift.test/decks/share/tok",
    );
    expect(shareLinkUrl("tierList", { shareToken: "tok", isPublic: true })).toBe(
      "https://openrift.test/tier-lists/share/tok",
    );
    expect(shareLinkUrl("bundle", { shareToken: "tok", isPublic: true })).toBe(
      "https://openrift.test/users/share/tok",
    );
  });

  it("has no URL without a token", () => {
    expect(shareLinkUrl("list", { shareToken: null, isPublic: true })).toBeNull();
  });

  it("has no URL for a token that is not public, which would 404", () => {
    expect(shareLinkUrl("list", { shareToken: "tok", isPublic: false })).toBeNull();
  });
});
