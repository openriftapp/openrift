import { beforeEach, describe, expect, it, vi } from "vitest";

const fns = vi.hoisted(() => ({
  unignoreCard: vi.fn((_input: unknown) => Promise.resolve()),
  unignorePrinting: vi.fn((_input: unknown) => Promise.resolve()),
}));

vi.mock("@/features/admin/hooks/use-ignored-candidates", () => ({
  unignoreCandidateCardFn: fns.unignoreCard,
  unignoreCandidatePrintingFn: fns.unignorePrinting,
}));

const { ignoredCardsUndo, ignoredPrintingUndo } = await import("./candidate-undo");

beforeEach(() => {
  fns.unignoreCard.mockClear();
  fns.unignorePrinting.mockClear();
});

const { signal } = new AbortController();

describe("ignoredCardsUndo", () => {
  it("un-ignores every source the ignore covered", async () => {
    const sources = [
      { provider: "provider-a", externalId: "a1" },
      { provider: "provider-b", externalId: "b1" },
    ];
    const entry = ignoredCardsUndo(sources, "Ekko, Recurrent");
    expect(entry.label).toBe("Ignored Ekko, Recurrent");
    expect(entry.undoneLabel).toBe("Undone: Ekko, Recurrent is back in the queue");
    expect(entry.invalidates).toContainEqual(["admin", "workspace"]);

    await entry.undo(signal);

    expect(fns.unignoreCard.mock.calls).toEqual([
      [{ data: sources[0], signal }],
      [{ data: sources[1], signal }],
    ]);
  });
});

describe("ignoredPrintingUndo", () => {
  it("un-ignores the candidate printing with its finish", async () => {
    const candidate = { provider: "provider-a", externalId: "x9", finish: null };
    const entry = ignoredPrintingUndo(candidate, "Ekko, Recurrent");
    expect(entry.label).toBe("Ignored the provider-a printing on Ekko, Recurrent");

    await entry.undo(signal);

    expect(fns.unignorePrinting).toHaveBeenCalledWith({ data: candidate, signal });
  });
});
