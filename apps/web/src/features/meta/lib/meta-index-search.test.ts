import { describe, expect, it, vi } from "vitest";

import { metaIndexSearchWriter } from "./meta-index-search";

function writer(resetPage: boolean) {
  const write = vi.fn();
  return { write, ...metaIndexSearchWriter(write, { resetPage }) };
}

describe("metaIndexSearchWriter", () => {
  it("pushes a filter change and opens the first page", () => {
    const { write, setSearchParams } = writer(true);
    setSearchParams({ q: undefined, holds: "decks" });
    const [update, replace] = write.mock.calls[0] as [
      (prev: Record<string, unknown>) => Record<string, unknown>,
      boolean,
    ];
    expect(replace).toBe(false);
    expect(update({ page: 3, era: "ogn" })).toEqual({ era: "ogn", holds: "decks" });
  });

  it("keeps the page when the index has none to reset", () => {
    const { write, setSearchParams } = writer(false);
    setSearchParams({ q: "Ahri" });
    const [update] = write.mock.calls[0] as [
      (prev: Record<string, unknown>) => Record<string, unknown>,
    ];
    expect(update({ page: 2 })).toEqual({ page: 2, q: "Ahri" });
  });

  it("replaces the entry for typed search and clears an empty query", () => {
    const { write, commitQuery } = writer(true);
    commitQuery("");
    const [update, replace] = write.mock.calls[0] as [
      (prev: Record<string, unknown>) => Record<string, unknown>,
      boolean,
    ];
    expect(replace).toBe(true);
    expect(update({ q: "old" })).toEqual({});
  });
});
