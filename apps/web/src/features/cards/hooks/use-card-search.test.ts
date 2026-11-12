import { buildCardLookupIndex } from "@openrift/shared/card-lookup";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AdminSearchableCard } from "./use-card-search";
import { useAdminCardSearch, useAssignableCardSearch, useCardSearch } from "./use-card-search";

const cards: AdminSearchableCard[] = [
  {
    id: "c-1",
    slug: "yasuo-the-unforgiven",
    name: "Yasuo, the Unforgiven",
    types: ["unit"],
    shortCodes: ["OGN-202"],
  },
  { id: "c-2", slug: "kaisa", name: "Kai'Sa", types: ["unit", "champion"], shortCodes: [] },
  {
    id: "c-3",
    slug: "howling-abyss",
    name: "Howling Abyss",
    types: ["battlefield"],
    shortCodes: [],
  },
];

const rows = cards.map((card) => ({ ...card, types: [], tags: [] }));
const index = buildCardLookupIndex(rows, []);
const indexWithCodes = buildCardLookupIndex(rows, [
  { cardId: "c-1", shortCode: "OGN-202", publicCode: "OGN-202/298", printedName: null },
]);

describe("useCardSearch", () => {
  it("returns nothing below the minimum query length", () => {
    const { result } = renderHook(() => useCardSearch(index, "y"));

    expect(result.current).toEqual([]);
  });

  it("returns nothing for an empty candidate list", () => {
    const { result } = renderHook(() => useCardSearch(buildCardLookupIndex([], []), "yasuo"));

    expect(result.current).toEqual([]);
  });

  it("matches on name, case-insensitively", () => {
    const { result } = renderHook(() => useCardSearch(index, "YASUO"));

    expect(result.current.map((card) => card.id)).toEqual(["c-1"]);
  });

  it("folds punctuation so an apostrophe never decides a match", () => {
    const { result } = renderHook(() => useCardSearch(index, "kaisa"));

    expect(result.current.map((card) => card.id)).toEqual(["c-2"]);
  });

  it("matches a printing short code when codes are supplied", () => {
    const { result } = renderHook(() => useCardSearch(indexWithCodes, "ogn202"));

    expect(result.current.map((card) => card.id)).toEqual(["c-1"]);
  });

  it("cannot match a code when no codes are supplied", () => {
    const { result } = renderHook(() => useCardSearch(index, "ogn202"));

    expect(result.current).toEqual([]);
  });

  it("honors the result limit", () => {
    const { result } = renderHook(() => useCardSearch(index, "a", 1, 1));

    expect(result.current).toHaveLength(1);
  });

  it("ranks a prefix match above a substring match when the minimum is lowered", () => {
    const { result } = renderHook(() => useCardSearch(index, "h", 20, 1));

    expect(result.current.map((card) => card.id)).toEqual(["c-3", "c-1"]);
  });

  it("returns no match for a query nothing contains", () => {
    const { result } = renderHook(() => useCardSearch(index, "zaun"));

    expect(result.current).toEqual([]);
  });
});

describe("useAdminCardSearch", () => {
  it("maps matches to the dropdown's row shape, text-only", () => {
    const { result } = renderHook(() => useAdminCardSearch(cards, "kai"));

    expect(result.current).toEqual([
      { id: "c-2", label: "Kai'Sa", sublabel: "kaisa", detail: "unit champion" },
    ]);
    expect(result.current[0]).not.toHaveProperty("leading");
  });

  it("returns nothing below the minimum query length", () => {
    const { result } = renderHook(() => useAdminCardSearch(cards, "k"));

    expect(result.current).toEqual([]);
  });
});

describe("useAssignableCardSearch", () => {
  const assignable = [
    {
      cardId: "c-1",
      cardSlug: "yasuo-the-unforgiven",
      cardName: "Yasuo, the Unforgiven",
      setName: "Origins",
      shortCodes: ["OGN-300", "OGN-202"],
    },
  ];

  it("shows the lowest short code and the set name", () => {
    const { result } = renderHook(() => useAssignableCardSearch(assignable, "yasuo"));

    expect(result.current).toEqual([
      { id: "c-1", label: "Yasuo, the Unforgiven", sublabel: "OGN-202", detail: "Origins" },
    ]);
  });

  it("matches on a short code, which is what makes it worth the extra wiring", () => {
    const { result } = renderHook(() => useAssignableCardSearch(assignable, "ogn300"));

    expect(result.current.map((card) => card.id)).toEqual(["c-1"]);
  });

  it("returns nothing when the card has no codes and the query is one", () => {
    const { result } = renderHook(() =>
      useAssignableCardSearch([{ ...assignable[0]!, shortCodes: [] }], "ogn202"),
    );

    expect(result.current).toEqual([]);
  });
});
