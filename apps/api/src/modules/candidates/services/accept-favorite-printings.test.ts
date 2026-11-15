import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Transact } from "../../../deps.js";
import { candidatePrintingRow } from "../../../test/candidate-printing-row.js";
import type { NewPrinting } from "../../catalog/services/printing-admin.js";

vi.mock("./accept-candidate-printings.js", () => ({
  acceptCandidateGroup: vi.fn(),
}));

import { acceptCandidateGroup } from "./accept-candidate-printings.js";
import { acceptFavoritePrintingsForCard } from "./accept-favorite-printings.js";

const transact = vi.fn() as unknown as Transact;

function makeRepos(
  printings = [candidatePrintingRow("cp-1")],
  probes: { shortCode: string; [key: string]: unknown }[] = [],
) {
  return {
    catalogMutations: {
      getCardBySlug: vi.fn(async () => ({ id: "card-1", name: "Poro Herder" })),
      findFaceIdByIdentity: vi.fn(async () => undefined),
    },
    candidateCards: {
      cardNameKeys: vi.fn(async () => ["poroherder", "poroherd"]),
      candidateCardsForDetail: vi.fn(async () => [
        { id: "cc-1", provider: "gallery" },
        { id: "cc-2", provider: "other" },
      ]),
      acceptableCandidatePrintings: vi.fn(async () => printings),
      checkCandidateCardsByIds: vi.fn(async () => 1),
    },
    workspaceBatch: { frontPrintingProbes: vi.fn(async () => probes) },
    enums: {
      all: vi.fn(async () => ({
        languages: [{ slug: "EN" }],
        rarities: [{ slug: "rare" }],
        artVariants: [{ slug: "normal" }],
        finishes: [{ slug: "normal" }],
        cardSizes: [{ slug: "standard" }],
        markers: [],
      })),
    },
    distributionChannels: { listBySlugs: vi.fn(async () => []) },
    sets: {},
    keywords: {},
  };
}

function accept(repos: ReturnType<typeof makeRepos>, created: NewPrinting[] = []) {
  return acceptFavoritePrintingsForCard(
    transact,
    repos as never,
    "poro-herder",
    new Set(["gallery"]),
    created,
  );
}

const DUPLICATE_PROBE = {
  printingId: "pr-9",
  cardId: "card-1",
  shortCode: "OGN-027",
  finish: "normal",
  language: "EN",
  size: "standard",
  distributionChannelSlugs: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(acceptCandidateGroup).mockResolvedValue({
    printing: { printingId: "p-1", imageIds: [] },
    fields: {} as never,
  });
});

describe("acceptFavoritePrintingsForCard", () => {
  it("accepts the favorite providers' unlinked, unignored candidates", async () => {
    const repos = makeRepos();
    const created: NewPrinting[] = [];

    const result = await accept(repos, created);

    expect(repos.candidateCards.cardNameKeys).toHaveBeenCalledWith("card-1");
    expect(repos.candidateCards.candidateCardsForDetail).toHaveBeenCalledWith([
      "poroherder",
      "poroherd",
    ]);
    expect(repos.candidateCards.acceptableCandidatePrintings).toHaveBeenCalledWith(["cc-1"]);
    expect(acceptCandidateGroup).toHaveBeenCalledWith(transact, "card-1", [
      expect.objectContaining({ id: "cp-1" }),
    ]);
    expect(repos.candidateCards.checkCandidateCardsByIds).toHaveBeenCalledWith(
      ["cc-1"],
      expect.any(Date),
    );
    expect(result).toEqual({ printingsCreated: 1, skipped: [], createdPrintingIds: ["p-1"] });
    expect(created).toEqual([{ printingId: "p-1", imageIds: [] }]);
  });

  it("accepts for a card that has no alias rows, by its own name", async () => {
    const repos = makeRepos();
    repos.candidateCards.cardNameKeys.mockResolvedValue(["poroherder"]);

    const result = await accept(repos);

    expect(repos.candidateCards.candidateCardsForDetail).toHaveBeenCalledWith(["poroherder"]);
    expect(result.printingsCreated).toBe(1);
  });

  it("looks for nothing when the card has no usable name key", async () => {
    const repos = makeRepos();
    repos.candidateCards.cardNameKeys.mockResolvedValue([]);

    const result = await accept(repos);

    expect(repos.candidateCards.candidateCardsForDetail).not.toHaveBeenCalled();
    expect(result.printingsCreated).toBe(0);
  });

  it("skips a possible duplicate with the batch's reason and checks nothing", async () => {
    const repos = makeRepos([candidatePrintingRow("cp-1")], [DUPLICATE_PROBE]);

    const result = await accept(repos);

    expect(acceptCandidateGroup).not.toHaveBeenCalled();
    expect(result.skipped).toEqual([
      { shortCode: "OGN-027", reason: "possible duplicate of OGN-027" },
    ]);
    expect(repos.candidateCards.checkCandidateCardsByIds).not.toHaveBeenCalled();
  });

  it("accepts a new foil of an existing code", async () => {
    const repos = makeRepos([candidatePrintingRow("cp-1", { finish: "foil" })], [DUPLICATE_PROBE]);
    repos.enums.all.mockResolvedValue({
      languages: [{ slug: "EN" }],
      rarities: [{ slug: "rare" }],
      artVariants: [{ slug: "normal" }],
      finishes: [{ slug: "normal" }, { slug: "foil" }],
      cardSizes: [{ slug: "standard" }],
      markers: [],
    });

    const result = await accept(repos);

    expect(result).toMatchObject({ printingsCreated: 1, skipped: [] });
  });

  it("accepts a new alt-art of an existing code", async () => {
    const repos = makeRepos(
      [candidatePrintingRow("cp-1", { shortCode: "OGN-027a" })],
      [DUPLICATE_PROBE],
    );

    const result = await accept(repos);

    expect(result).toMatchObject({ printingsCreated: 1, skipped: [] });
  });

  it("skips a group with a value no admin list holds", async () => {
    const repos = makeRepos([candidatePrintingRow("cp-1", { finish: "glossy" })]);

    const result = await accept(repos);

    expect(acceptCandidateGroup).not.toHaveBeenCalled();
    expect(result.skipped).toEqual([
      { shortCode: "OGN-027", reason: 'not on an admin list: finish "glossy"' },
    ]);
  });

  it("hands back a created printing when a later group's check throws", async () => {
    const repos = makeRepos([
      candidatePrintingRow("cp-1"),
      candidatePrintingRow("cp-2", { shortCode: "OGN-028", publicCode: "OGN-028/298" }),
    ]);
    repos.catalogMutations.findFaceIdByIdentity
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("connection reset"));
    const created: NewPrinting[] = [];

    await expect(accept(repos, created)).rejects.toThrow("connection reset");
    expect(created).toEqual([{ printingId: "p-1", imageIds: [] }]);
  });

  it("hands back the printings it created when marking checked throws", async () => {
    const repos = makeRepos();
    repos.candidateCards.checkCandidateCardsByIds.mockRejectedValue(new Error("connection reset"));
    const created: NewPrinting[] = [];

    await expect(accept(repos, created)).rejects.toThrow("connection reset");
    expect(created).toEqual([{ printingId: "p-1", imageIds: [] }]);
  });

  it("returns early without checking anything when nothing is left to accept", async () => {
    const repos = makeRepos([]);

    const result = await accept(repos);

    expect(result.printingsCreated).toBe(0);
    expect(acceptCandidateGroup).not.toHaveBeenCalled();
    expect(repos.candidateCards.checkCandidateCardsByIds).not.toHaveBeenCalled();
  });
});
