import { describe, expect, it } from "vitest";

import { cardShareUrl } from "@/features/cards/lib/card-share-url";

describe("cardShareUrl", () => {
  it("pins the printing in the path", () => {
    expect(cardShareUrl("https://example.test", "blazing-scorcher", "ogn-001-en")).toBe(
      "https://example.test/cards/blazing-scorcher/ogn-001-en",
    );
  });

  it("keeps the back side when it is selected", () => {
    expect(cardShareUrl("https://example.test", "jinx", "ogn-002-en", 2)).toBe(
      "https://example.test/cards/jinx/ogn-002-en?side=2",
    );
  });

  it("falls back to the bare card URL without a printing slug", () => {
    expect(cardShareUrl("https://example.test", "blazing-scorcher")).toBe(
      "https://example.test/cards/blazing-scorcher",
    );
  });

  it("encodes slug characters that are not path-safe", () => {
    expect(cardShareUrl("https://example.test", "a b", "c/d")).toBe(
      "https://example.test/cards/a%20b/c%2Fd",
    );
  });
});
