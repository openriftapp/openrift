import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { useResolvedCardIndex } from "./use-resolved-card-index";

describe("useResolvedCardIndex", () => {
  it("keeps one row per card, represented by its first printing", () => {
    const first = stubPrinting({ cardId: "card-a", shortCode: "OGN-001", card: { name: "Ahri" } });
    const second = stubPrinting({ cardId: "card-a", shortCode: "OGN-001a" });
    const other = stubPrinting({ cardId: "card-b", shortCode: "OGN-002", card: { name: "Garen" } });

    const { result } = renderHook(() => useResolvedCardIndex([first, second, other]));

    expect(result.current.rows.map((row) => row.id)).toEqual(["card-a", "card-b"]);
    expect(result.current.rows[0]?.card).toMatchObject({
      cardId: "card-a",
      cardName: "Ahri",
      shortCode: "OGN-001",
      preferredPrintingId: null,
    });
  });

  it("indexes each card by its representative printing's short and public codes", () => {
    const printing = stubPrinting({
      cardId: "card-a",
      shortCode: "OGN-001",
      publicCode: "OGN-001/298",
    });

    const { result } = renderHook(() => useResolvedCardIndex([printing]));

    expect(result.current.codesByCardId.get("card-a")).toEqual([
      { shortCode: "OGN-001", publicCode: "OGN-001/298" },
    ]);
  });

  it("returns no rows for an empty catalog", () => {
    const { result } = renderHook(() => useResolvedCardIndex([]));

    expect(result.current.rows).toEqual([]);
    expect(result.current.codesByCardId.size).toBe(0);
  });
});
