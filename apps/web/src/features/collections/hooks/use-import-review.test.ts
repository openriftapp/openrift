import type { Printing } from "@openrift/shared/types/catalog";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

const catalog = vi.hoisted(() => ({ allPrintings: [] as Printing[] }));

vi.mock("@/features/cards/hooks/use-cards", () => ({ useCards: () => catalog }));
vi.mock("@/hooks/use-enums", async () => {
  const { labelMap } = await import("@openrift/shared/enum-label");
  return {
    useEnumOrders: () => ({ labels: { finishes: labelMap([]) } }),
    useLanguageLabels: () => labelMap([]),
  };
});
vi.mock("@/stores/display-store", () => ({
  useDisplayStore: (selector: (state: { languages: string[] }) => unknown) =>
    selector({ languages: [] }),
}));

const { useImportReview } = await import("./use-import-review");

catalog.allPrintings = [
  stubPrinting({
    cardId: "teemo",
    shortCode: "OGN-001",
    finish: "normal",
    card: { name: "Teemo, Scout" },
  }),
  stubPrinting({
    cardId: "teemo",
    shortCode: "OGN-001",
    finish: "foil",
    card: { name: "Teemo, Scout" },
  }),
  stubPrinting({ cardId: "annie", shortCode: "OGN-003", card: { name: "Annie, Fiery" } }),
  stubPrinting({ cardId: "jinx", shortCode: "OGN-002", card: { name: "Jinx, Rebel" } }),
];

function parse(options: Parameters<typeof useImportReview>[0], text: string) {
  const { result } = renderHook(() => useImportReview(options));
  act(() => {
    result.current.handleParse(text);
  });
  return result.current;
}

describe("useImportReview", () => {
  it("leaves a single-card ambiguity for review unless asked to promote it", () => {
    const kept = parse({ promoteSingleCard: false, tieBreak: "cardName" }, "1 Teemo, Scout");
    const promoted = parse({ promoteSingleCard: true, tieBreak: "cardName" }, "1 Teemo, Scout");

    expect(kept.step).toBe("preview");
    expect(kept.matchedEntries.map((entry) => entry.status)).toEqual(["needs-review"]);
    expect(promoted.matchedEntries.map((entry) => entry.status)).toEqual(["exact"]);
    expect(promoted.importableEntries).toHaveLength(1);
  });

  it("breaks status ties by the chosen field", () => {
    const text = "1 Annie, Fiery · OGN-003\n1 Teemo, Scout · OGN-001\n1 Jinx, Rebel · OGN-002";
    const options = { promoteSingleCard: true } as const;
    const byCardName = parse({ ...options, tieBreak: "cardName" }, text).matchedEntries;
    const bySourceCode = parse({ ...options, tieBreak: "sourceCode" }, text).matchedEntries;

    expect(new Set(bySourceCode.map((entry) => entry.status))).toEqual(new Set(["exact"]));
    expect(byCardName.map((entry) => entry.entry.cardName)).toEqual([
      "Annie, Fiery",
      "Jinx, Rebel",
      "Teemo, Scout",
    ]);
    expect(bySourceCode.map((entry) => entry.entry.cardName)).toEqual([
      "Teemo, Scout",
      "Jinx, Rebel",
      "Annie, Fiery",
    ]);
  });

  it("returns to an empty input step on reset", () => {
    const { result } = renderHook(() =>
      useImportReview({ promoteSingleCard: false, tieBreak: "sourceCode" }),
    );
    act(() => {
      result.current.setRawText("1 Annie, Fiery");
      result.current.handleParse("1 Annie, Fiery");
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.step).toBe("input");
    expect(result.current.rawText).toBe("");
    expect(result.current.matchedEntries).toEqual([]);
  });
});
