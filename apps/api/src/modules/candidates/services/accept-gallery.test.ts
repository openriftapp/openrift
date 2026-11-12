import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Transact } from "../../../deps.js";
import { candidatePrintingRow } from "../../../test/candidate-printing-row.js";
import type { NewPrinting } from "../../catalog/services/printing-admin.js";
import { acceptFavoriteNewCard } from "./accept-gallery.js";

vi.mock("./accept-candidate-printings.js", () => ({
  acceptCandidateGroups: vi.fn(),
}));
vi.mock("./relink-candidates.js", () => ({
  relinkCandidatePrintings: vi.fn(async () => ({ examined: 0, linked: 0 })),
}));

import { acceptCandidateGroups } from "./accept-candidate-printings.js";
import { relinkCandidatePrintings } from "./relink-candidates.js";

const FAVORITE_PROVIDERS = new Set(["gallery", "tcgplayer"]);

function mockTransact(trxRepos: unknown): Transact {
  return (fn) => fn(trxRepos as any) as any;
}

function makeCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "cand-1",
    name: "Flame Striker",
    shortCode: "OGN-001",
    provider: "gallery",
    types: ["unit"],
    superTypes: ["Elemental"],
    domains: ["Fire"],
    might: 3,
    energy: 2,
    power: null,
    mightBonus: null,
    tags: ["burn"],
    ...overrides,
  };
}

function createMockRepos(
  overrides: {
    candidates?: ReturnType<typeof makeCandidate>[];
    existingCard?: { id: string } | null;
  } = {},
) {
  const candidates = overrides.candidates ?? [makeCandidate()];
  const printings = [candidatePrintingRow("cp-1")];
  const existingCard = overrides.existingCard ?? null;

  const candidateCards = {
    candidateCardsByNormName: vi.fn(async () => candidates),
    acceptableCandidatePrintings: vi.fn(async () => printings),
    checkCandidateCard: vi.fn(async () => {}),
  };

  const catalogMutations = {
    getCardIdBySlug: vi.fn(async () => existingCard),
    acceptNewCardFromSources: vi.fn(async () => "new-card-uuid"),
    createNameAliases: vi.fn(async () => {}),
  };

  const repos = { candidateCards, catalogMutations, ingest: {} } as unknown as Parameters<
    typeof acceptFavoriteNewCard
  >[1];

  return { repos, candidateCards, catalogMutations, printings };
}

describe("acceptFavoriteNewCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(acceptCandidateGroups).mockResolvedValue({
      created: [{ printingId: "p-1", imageIds: [] }],
      skipped: [{ shortCode: "OGN-002", reason: "missing: artist" }],
    });
  });

  it("404s when no favorite candidates exist", async () => {
    const { repos } = createMockRepos({ candidates: [] });

    await expect(
      acceptFavoriteNewCard(mockTransact(repos), repos, "flamestriker", FAVORITE_PROVIDERS, []),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("filters out non-favorite providers", async () => {
    const { repos } = createMockRepos({
      candidates: [makeCandidate({ id: "c1", provider: "unknown-provider" })],
    });

    await expect(
      acceptFavoriteNewCard(mockTransact(repos), repos, "flamestriker", FAVORITE_PROVIDERS, []),
    ).rejects.toThrow("No favorite-provider source found for this card");
  });

  it("400s a source without a card type instead of failing in the database", async () => {
    const { repos, catalogMutations } = createMockRepos({
      candidates: [makeCandidate({ types: [] })],
    });

    await expect(
      acceptFavoriteNewCard(mockTransact(repos), repos, "flamestriker", FAVORITE_PROVIDERS, []),
    ).rejects.toMatchObject({ status: 400 });
    expect(catalogMutations.acceptNewCardFromSources).not.toHaveBeenCalled();
  });

  it("creates a new card and accepts its candidates onto it", async () => {
    const { repos, catalogMutations, candidateCards, printings } = createMockRepos();

    const created: NewPrinting[] = [];
    const result = await acceptFavoriteNewCard(
      mockTransact(repos),
      repos,
      "flamestriker",
      FAVORITE_PROVIDERS,
      created,
    );

    expect(catalogMutations.acceptNewCardFromSources).toHaveBeenCalledTimes(1);
    expect(relinkCandidatePrintings).not.toHaveBeenCalled();
    expect(candidateCards.acceptableCandidatePrintings).toHaveBeenCalledWith(["cand-1"]);
    expect(vi.mocked(acceptCandidateGroups).mock.calls[0]?.slice(1)).toEqual([
      "new-card-uuid",
      printings,
    ]);
    expect(result).toEqual({
      cardSlug: "flame-striker",
      printingsCreated: 1,
      skipped: [{ shortCode: "OGN-002", reason: "missing: artist" }],
    });
    expect(created).toEqual([{ printingId: "p-1", imageIds: [] }]);
  });

  it("hands back the printings it created when a later step throws", async () => {
    const { repos, candidateCards } = createMockRepos();
    candidateCards.checkCandidateCard.mockRejectedValue(new Error("connection reset"));
    const created: NewPrinting[] = [];

    await expect(
      acceptFavoriteNewCard(
        mockTransact(repos),
        repos,
        "flamestriker",
        FAVORITE_PROVIDERS,
        created,
      ),
    ).rejects.toThrow("connection reset");
    expect(created).toEqual([{ printingId: "p-1", imageIds: [] }]);
  });

  it("on an existing card, links matching candidates before accepting the rest", async () => {
    const { repos, catalogMutations, candidateCards } = createMockRepos({
      existingCard: { id: "card-uuid-1" },
    });

    await acceptFavoriteNewCard(mockTransact(repos), repos, "flamestriker", FAVORITE_PROVIDERS, []);

    expect(catalogMutations.createNameAliases).toHaveBeenCalledWith("flamestriker", "card-uuid-1");
    expect(catalogMutations.acceptNewCardFromSources).not.toHaveBeenCalled();
    expect(relinkCandidatePrintings).toHaveBeenCalledTimes(1);
    expect(vi.mocked(relinkCandidatePrintings).mock.invocationCallOrder[0]).toBeLessThan(
      candidateCards.acceptableCandidatePrintings.mock.invocationCallOrder[0]!,
    );
    expect(vi.mocked(acceptCandidateGroups).mock.calls[0]?.[1]).toBe("card-uuid-1");
  });

  it("derives the slug from the card name", async () => {
    const { repos } = createMockRepos({
      candidates: [makeCandidate({ shortCode: "OGN-001a" })],
    });

    const result = await acceptFavoriteNewCard(
      mockTransact(repos),
      repos,
      "flamestriker",
      FAVORITE_PROVIDERS,
      [],
    );

    expect(result.cardSlug).toBe("flame-striker");
  });

  it("marks only favorite candidates as checked", async () => {
    const cands = [
      makeCandidate({ id: "cand-1", provider: "gallery" }),
      makeCandidate({ id: "cand-2", provider: "tcgplayer" }),
      makeCandidate({ id: "cand-3", provider: "unknown" }),
    ];
    const { repos, candidateCards } = createMockRepos({ candidates: cands });

    await acceptFavoriteNewCard(mockTransact(repos), repos, "flamestriker", FAVORITE_PROVIDERS, []);

    expect(candidateCards.checkCandidateCard).toHaveBeenCalledTimes(2);
    expect(candidateCards.checkCandidateCard).toHaveBeenCalledWith("cand-1");
    expect(candidateCards.checkCandidateCard).toHaveBeenCalledWith("cand-2");
  });
});
