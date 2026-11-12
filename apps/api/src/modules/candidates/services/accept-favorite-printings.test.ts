import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Transact } from "../../../deps.js";
import { candidatePrintingRow } from "../../../test/candidate-printing-row.js";
import type { NewPrinting } from "../../catalog/services/printing-admin.js";

vi.mock("./accept-candidate-printings.js", () => ({
  acceptCandidateGroups: vi.fn(),
}));

import { acceptCandidateGroups } from "./accept-candidate-printings.js";
import { acceptFavoritePrintingsForCard } from "./accept-favorite-printings.js";

const transact = vi.fn() as unknown as Transact;

function makeRepos(printings = [candidatePrintingRow("cp-1")]) {
  return {
    catalogMutations: {
      getCardBySlug: vi.fn(async () => ({ id: "card-1" })),
      getCardAliases: vi.fn(async () => [{ normName: "poroherder" }]),
    },
    candidateCards: {
      candidateCardsForDetail: vi.fn(async () => [
        { id: "cc-1", provider: "gallery" },
        { id: "cc-2", provider: "other" },
      ]),
      acceptableCandidatePrintings: vi.fn(async () => printings),
      checkCandidateCard: vi.fn(async () => {}),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(acceptCandidateGroups).mockResolvedValue({
    created: [{ printingId: "p-1", imageIds: [] }],
    skipped: [{ shortCode: "OGN-028", reason: "missing: artist" }],
  });
});

describe("acceptFavoritePrintingsForCard", () => {
  it("accepts the favorite providers' unlinked, unignored candidates", async () => {
    const repos = makeRepos();
    const created: NewPrinting[] = [];

    const result = await acceptFavoritePrintingsForCard(
      transact,
      repos as never,
      "poro-herder",
      new Set(["gallery"]),
      created,
    );

    expect(repos.candidateCards.acceptableCandidatePrintings).toHaveBeenCalledWith(["cc-1"]);
    expect(acceptCandidateGroups).toHaveBeenCalledWith(transact, "card-1", [
      expect.objectContaining({ id: "cp-1" }),
    ]);
    expect(repos.candidateCards.checkCandidateCard).toHaveBeenCalledWith("cc-1");
    expect(result).toEqual({
      printingsCreated: 1,
      skipped: [{ shortCode: "OGN-028", reason: "missing: artist" }],
      createdPrintingIds: ["p-1"],
    });
    expect(created).toEqual([{ printingId: "p-1", imageIds: [] }]);
  });

  it("hands back the printings it created when a later step throws", async () => {
    const repos = makeRepos();
    repos.candidateCards.checkCandidateCard.mockRejectedValue(new Error("connection reset"));
    const created: NewPrinting[] = [];

    await expect(
      acceptFavoritePrintingsForCard(
        transact,
        repos as never,
        "poro-herder",
        new Set(["gallery"]),
        created,
      ),
    ).rejects.toThrow("connection reset");
    expect(created).toEqual([{ printingId: "p-1", imageIds: [] }]);
  });

  it("returns early without checking anything when nothing is left to accept", async () => {
    const repos = makeRepos([]);

    const result = await acceptFavoritePrintingsForCard(
      transact,
      repos as never,
      "poro-herder",
      new Set(["gallery"]),
      [],
    );

    expect(result.printingsCreated).toBe(0);
    expect(acceptCandidateGroups).not.toHaveBeenCalled();
    expect(repos.candidateCards.checkCandidateCard).not.toHaveBeenCalled();
  });
});
