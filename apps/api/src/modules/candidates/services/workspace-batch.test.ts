import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repos, Transact } from "../../../deps.js";
import type { Io } from "../../../io.js";
import type { AdminAccess } from "../../../middleware/require-admin.js";
import type { MarketplaceConfigs } from "../../marketplace/lib/marketplace-configs.js";
import type { UnassignedListings } from "../../marketplace/lib/unassigned-listings.js";

vi.mock("./accept-candidate-printings.js", () => ({
  acceptCandidateGroup: vi.fn(),
  finishPrintingAccepts: vi.fn(async () => {}),
}));
vi.mock("./accept-gallery.js", () => ({
  acceptFavoriteNewCard: vi.fn(),
}));
vi.mock("../../marketplace/services/marketplace-mapping.js", () => ({
  saveMappings: vi.fn(async () => ({ saved: 1, skipped: [] })),
}));

import { saveMappings } from "../../marketplace/services/marketplace-mapping.js";
import { acceptCandidateGroup, finishPrintingAccepts } from "./accept-candidate-printings.js";
import { acceptFavoriteNewCard } from "./accept-gallery.js";
import {
  acceptTrustedCards,
  acceptTrustedPrintings,
  assignSuggestedListings,
  previewSuggestedListings,
  previewTrustedCards,
  previewTrustedPrintings,
  strongListings,
} from "./workspace-batch.js";

const ADMIN: AdminAccess = { isAdmin: true, sections: [] };
const HELPER: AdminAccess = { isAdmin: false, sections: ["card-review"] };

function printing(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    candidateCardId: "cc-1",
    printingId: null,
    shortCode: "OGN-027",
    setId: "ogn",
    setName: "Origins",
    rarity: "rare",
    artVariant: null,
    isSigned: null,
    isOvernumbered: null,
    markerSlugs: [],
    distributionChannelSlugs: [],
    finish: "normal",
    size: null,
    artist: "Kudos Productions",
    publicCode: "OGN-027/298",
    language: "EN",
    ...over,
  };
}

function makeRepos(
  over: { printings?: unknown[]; probes?: unknown[]; storedFace?: Record<string, unknown> } = {},
) {
  return {
    providerSettings: { favoriteProviders: vi.fn(async () => new Set(["gallery"])) },
    workspaceBatch: {
      trustedNewCardDrafts: vi.fn(async () => [
        {
          id: "cc-1",
          provider: "gallery",
          normName: "poroherder",
          name: "Poro Herder",
          types: ["unit"],
        },
        {
          id: "cc-2",
          provider: "gallery",
          normName: "blastcone",
          name: "Blast Cone",
          types: ["spell"],
        },
      ]),
      trustedNewPrintings: vi.fn(async () => [
        {
          id: "p1",
          candidateCardId: "cc-1",
          provider: "gallery",
          cardId: "card-1",
          cardSlug: "poro",
        },
        {
          id: "p2",
          candidateCardId: "cc-1",
          provider: "gallery",
          cardId: "card-1",
          cardSlug: "poro",
        },
        {
          id: "p3",
          candidateCardId: "cc-1",
          provider: "gallery",
          cardId: "card-1",
          cardSlug: "poro",
        },
        {
          id: "p4",
          candidateCardId: "cc-1",
          provider: "gallery",
          cardId: "card-1",
          cardSlug: "poro",
        },
      ]),
      frontPrintingProbes: vi.fn(async () => over.probes ?? []),
    },
    candidateCards: {
      listCardsForSourceList: vi.fn(async () => []),
      allCandidatePrintingsForCandidateCards: vi.fn(async () => over.printings ?? []),
    },
    catalog: { refreshCatalogViews: vi.fn(async () => {}) },
    catalogMutations: {
      findFaceIdByIdentity: vi.fn(async () => (over.storedFace ? { id: "face-1" } : undefined)),
      getFacePrintedFields: vi.fn(async () => over.storedFace),
      getSetIdBySlug: vi.fn(async () => ({ id: "set-uuid" })),
    },
    sets: { getPrintedTotal: vi.fn(async () => null) },
    keywords: { listCostKeywords: vi.fn(async () => []) },
    adminEvents: { insert: vi.fn(async () => {}) },
    enums: {
      all: vi.fn(async () => ({
        languages: [{ slug: "EN" }],
        rarities: [{ slug: "common" }, { slug: "rare" }],
        artVariants: [{ slug: "normal" }],
        finishes: [{ slug: "normal" }, { slug: "foil" }],
        cardSizes: [{ slug: "standard" }, { slug: "oversized" }],
        markers: [],
      })),
    },
    distributionChannels: { listBySlugs: vi.fn(async () => []) },
  };
}

function asRepos(repos: ReturnType<typeof makeRepos>): Repos {
  return repos as unknown as Repos;
}

const transact = vi.fn() as unknown as Transact;
const io = {} as Io;

function context(access: AdminAccess | null = ADMIN) {
  return { access, userId: "user-1", transact, io };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("trusted cards", () => {
  const printings = [printing("p1"), printing("p2", { candidateCardId: "cc-2" })];

  it("rejects non-admins", async () => {
    await expect(previewTrustedCards(asRepos(makeRepos()), HELPER)).rejects.toMatchObject({
      status: 403,
    });
    await expect(acceptTrustedCards(asRepos(makeRepos()), context(null))).rejects.toMatchObject({
      status: 403,
    });
  });

  it("previews complete drafts", async () => {
    const repos = makeRepos({ printings });
    expect(await previewTrustedCards(asRepos(repos), ADMIN)).toEqual({
      count: 2,
      names: ["Blast Cone", "Poro Herder"],
      ineligible: [],
    });
    expect(repos.workspaceBatch.trustedNewCardDrafts).toHaveBeenCalledWith(["gallery"]);
  });

  it("accepts each draft, records an event per card, reports failures and finishes once", async () => {
    const created = [{ printingId: "printing-1", imageIds: [] }];
    vi.mocked(acceptFavoriteNewCard)
      .mockRejectedValueOnce(new Error("Card already exists"))
      .mockImplementationOnce(async (_transact, _repos, _name, _providers, sink) => {
        sink.push(...created);
        return { cardSlug: "poro-herder", printingsCreated: 1, skipped: [] };
      });
    const repos = makeRepos({ printings });

    const result = await acceptTrustedCards(asRepos(repos), context());

    expect(result).toEqual({
      accepted: 1,
      skipped: [{ name: "Blast Cone", reason: "Card already exists" }],
    });
    expect(acceptFavoriteNewCard).toHaveBeenCalledTimes(2);
    expect(repos.adminEvents.insert).toHaveBeenCalledTimes(1);
    expect(repos.adminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "card.accept-favorites", cardSlug: "poro-herder" }),
    );
    expect(finishPrintingAccepts).toHaveBeenCalledWith(repos, io, created, {
      catalogChanged: true,
    });
  });

  it("still finishes the printings a draft created before it failed", async () => {
    const created = [{ printingId: "printing-1", imageIds: ["img-1"] }];
    vi.mocked(acceptFavoriteNewCard).mockImplementation(
      async (_transact, _repos, _name, _providers, sink) => {
        sink.push(...created);
        throw new Error("connection reset");
      },
    );
    const repos = makeRepos({ printings });

    const result = await acceptTrustedCards(asRepos(repos), context());

    expect(result.accepted).toBe(0);
    expect(result.skipped).toContainEqual({ name: "Poro Herder", reason: "connection reset" });
    expect(finishPrintingAccepts).toHaveBeenCalledWith(repos, io, [...created, ...created], {
      catalogChanged: false,
    });
  });

  it("refreshes the views for cards accepted without printings", async () => {
    vi.mocked(acceptFavoriteNewCard).mockResolvedValue({
      cardSlug: "poro-herder",
      printingsCreated: 0,
      skipped: [],
    });
    const repos = makeRepos({ printings });

    await acceptTrustedCards(asRepos(repos), context());

    expect(finishPrintingAccepts).toHaveBeenCalledWith(repos, io, [], { catalogChanged: true });
  });

  it("reports ineligible drafts as skipped and skips the view refresh when nothing was accepted", async () => {
    const repos = makeRepos();
    const incomplete = "no printing has every required field";
    expect(await acceptTrustedCards(asRepos(repos), context())).toEqual({
      accepted: 0,
      skipped: [
        { name: "Blast Cone", reason: incomplete },
        { name: "Poro Herder", reason: incomplete },
      ],
    });
    expect(finishPrintingAccepts).toHaveBeenCalledWith(repos, io, [], { catalogChanged: false });
  });
});

describe("trusted printings", () => {
  const printings = [
    printing("p1"),
    printing("p2"),
    printing("p3", { shortCode: "OGN-030", rarity: null }),
    printing("p4", { shortCode: "OGN-031" }),
  ];
  const probes = [
    {
      printingId: "pr-9",
      cardId: "card-1",
      shortCode: "OGN-031",
      language: "EN",
      size: "standard",
      distributionChannelSlugs: [],
    },
  ];

  it("previews groups that are complete and not duplicates", async () => {
    const repos = makeRepos({ printings, probes });
    expect(await previewTrustedPrintings(asRepos(repos), ADMIN)).toEqual({
      count: 1,
      items: [{ candidatePrintingId: "p1", cardSlug: "poro", label: "OGN-027 normal EN" }],
      ineligible: [
        { candidatePrintingId: "p3", label: "poro OGN-030 normal EN", reason: "missing: rarity" },
        {
          candidatePrintingId: "p4",
          label: "poro OGN-031 normal EN",
          reason: "possible duplicate of OGN-031",
        },
      ],
    });
  });

  it("accepts each group as new, records events and finishes once", async () => {
    const created = { printingId: "printing-1", imageIds: [] };
    vi.mocked(acceptCandidateGroup).mockResolvedValueOnce({
      printing: created,
      fields: { shortCode: "OGN-027" } as never,
    });
    const repos = makeRepos({ printings, probes });

    const result = await acceptTrustedPrintings(asRepos(repos), context());

    expect(result.accepted).toBe(1);
    expect(result.skipped).toEqual([
      { label: "poro OGN-030 normal EN", reason: "missing: rarity" },
      { label: "poro OGN-031 normal EN", reason: "possible duplicate of OGN-031" },
    ]);
    expect(acceptCandidateGroup).toHaveBeenCalledWith(transact, "card-1", [
      expect.objectContaining({ id: "p1" }),
      expect.objectContaining({ id: "p2" }),
    ]);
    expect(repos.adminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "printing.accept", entityId: "printing-1" }),
    );
    expect(finishPrintingAccepts).toHaveBeenCalledWith(repos, io, [created]);
  });

  describe("an oversized candidate next to the standard printing", () => {
    const standardProbe = {
      printingId: "pr-standard",
      cardId: "card-1",
      shortCode: "OGN-027",
      language: "EN",
      size: "standard",
      distributionChannelSlugs: [],
    };
    const sameFace = {
      setId: "set-uuid",
      rarity: "rare",
      artVariant: "normal",
      isSigned: false,
      isOvernumbered: false,
      artist: "Kudos Productions",
      publicCode: "OGN-027/298",
      printedRulesText: null,
      printedEffectText: null,
      flavorText: null,
      printedName: null,
      printedYear: null,
    };
    const oversized = [printing("p1", { size: "oversized" })];

    it("is ineligible with the artist reason when the shared side's artist differs", async () => {
      const repos = makeRepos({
        printings: oversized,
        probes: [standardProbe],
        storedFace: { ...sameFace, artist: "Someone Else" },
      });

      const preview = await previewTrustedPrintings(asRepos(repos), ADMIN);
      const run = await acceptTrustedPrintings(asRepos(repos), context());

      const reason =
        "The existing OGN-027 normal EN side differs in artist. Edit that side or the source first.";
      expect(preview.ineligible.map((entry) => entry.reason)).toEqual([reason]);
      expect(run.skipped.map((entry) => entry.reason)).toEqual([reason]);
      expect(acceptCandidateGroup).not.toHaveBeenCalled();
    });

    it("is eligible and created when the shared side's values match", async () => {
      vi.mocked(acceptCandidateGroup).mockResolvedValueOnce({
        printing: { printingId: "printing-oversized", imageIds: [] },
        fields: { shortCode: "OGN-027" } as never,
      });
      const repos = makeRepos({
        printings: oversized,
        probes: [standardProbe],
        storedFace: sameFace,
      });

      const preview = await previewTrustedPrintings(asRepos(repos), ADMIN);
      const run = await acceptTrustedPrintings(asRepos(repos), context());

      expect(preview).toMatchObject({ count: 1, ineligible: [] });
      expect(run).toEqual({ accepted: 1, skipped: [] });
    });

    it("is a duplicate when an oversized printing already exists", async () => {
      const repos = makeRepos({
        printings: oversized,
        probes: [{ ...standardProbe, size: "oversized" }],
      });

      const preview = await previewTrustedPrintings(asRepos(repos), ADMIN);

      expect(preview.ineligible.map((entry) => entry.reason)).toEqual([
        "possible duplicate of OGN-027",
      ]);
    });
  });

  it("previews a group whose existing side has different printed values as ineligible", async () => {
    const repos = makeRepos({
      printings: [printing("p1")],
      storedFace: {
        setId: "set-uuid",
        rarity: "rare",
        artVariant: "normal",
        isSigned: false,
        isOvernumbered: false,
        artist: "Someone Else",
        publicCode: "OGN-027/298",
        printedRulesText: null,
        printedEffectText: null,
        flavorText: null,
        printedName: null,
        printedYear: null,
      },
    });

    const preview = await previewTrustedPrintings(asRepos(repos), ADMIN);

    expect(preview.count).toBe(0);
    expect(preview.ineligible).toEqual([
      {
        candidatePrintingId: "p1",
        label: "poro OGN-027 normal EN",
        reason:
          "The existing OGN-027 normal EN side differs in artist. Edit that side or the source first.",
      },
    ]);
  });

  it("previews a group with a value no admin list holds as ineligible", async () => {
    const repos = makeRepos({ printings: [printing("p1", { finish: "glossy" })] });

    expect(await previewTrustedPrintings(asRepos(repos), ADMIN)).toEqual({
      count: 0,
      items: [],
      ineligible: [
        {
          candidatePrintingId: "p1",
          label: "poro OGN-027 glossy EN",
          reason: 'not on an admin list: finish "glossy"',
        },
      ],
    });
    const result = await acceptTrustedPrintings(asRepos(repos), context());
    expect(result.skipped).toEqual([
      { label: "poro OGN-027 glossy EN", reason: 'not on an admin list: finish "glossy"' },
    ]);
    expect(acceptCandidateGroup).not.toHaveBeenCalled();
  });

  it("skips a group without a public code", async () => {
    const repos = makeRepos({ printings: [printing("p1", { publicCode: null })] });

    const result = await acceptTrustedPrintings(asRepos(repos), context());

    expect(result.skipped).toEqual([
      { label: "poro OGN-027 normal EN", reason: "missing: publicCode" },
    ]);
    expect(acceptCandidateGroup).not.toHaveBeenCalled();
  });

  it("reports a conflict as skipped", async () => {
    vi.mocked(acceptCandidateGroup).mockResolvedValueOnce({ reason: "already has a printing" });
    const repos = makeRepos({ printings: [printing("p1")] });

    const result = await acceptTrustedPrintings(asRepos(repos), context());

    expect(result).toEqual({
      accepted: 0,
      skipped: [{ label: "poro OGN-027 normal EN", reason: "already has a printing" }],
    });
    expect(finishPrintingAccepts).toHaveBeenCalledWith(repos, io, []);
  });
});

function suggestion(
  externalId: number,
  printingId: string,
  strength: "strong" | "suggested" = "strong",
) {
  return {
    marketplace: "tcgplayer" as const,
    externalId,
    finish: "normal",
    language: null,
    productName: `Product ${externalId}`,
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    printingId,
    printingLabel: "OGN-027 normal EN",
    cardSlug: "poro",
    cardName: "Poro Herder",
    score: strength === "strong" ? 200 : 100,
    strength,
  };
}

const LISTINGS: UnassignedListings = {
  suggested: [
    suggestion(1, "pr-1"),
    suggestion(2, "pr-1", "suggested"),
    suggestion(3, "pr-1"),
    suggestion(3, "pr-2"),
    suggestion(4, "pr-4"),
  ],
  unmatched: [],
};

describe("suggested listings", () => {
  it("keeps listings with exactly one strong suggestion", () => {
    expect(strongListings(LISTINGS).map((item) => [item.listingKey, item.printingId])).toEqual([
      ["tcgplayer::1::normal::", "pr-1"],
      ["tcgplayer::4::normal::", "pr-4"],
    ]);
  });

  it("previews without the raw listing", async () => {
    const preview = await previewSuggestedListings(ADMIN, async () => LISTINGS);
    expect(preview.count).toBe(2);
    expect(preview.items[0]).toEqual({
      listingKey: "tcgplayer::1::normal::",
      printingId: "pr-1",
      label: "Product 1 → Poro Herder OGN-027 normal EN",
      strength: "strong",
    });
  });

  it("assigns each listing on its own, limited to the given keys", async () => {
    const configs = { tcgplayer: { marketplace: "tcgplayer" } } as unknown as MarketplaceConfigs;

    const result = await assignSuggestedListings(
      { access: ADMIN, transact, configs, input: { listingKeys: ["tcgplayer::4::normal::"] } },
      async () => LISTINGS,
    );

    expect(result).toEqual({ assigned: 1 });
    expect(saveMappings).toHaveBeenCalledTimes(1);
    expect(saveMappings).toHaveBeenCalledWith(transact, configs.tcgplayer, [
      { printingId: "pr-4", externalId: 4, finish: "normal", language: null },
    ]);
  });

  it("counts only saved listings and survives a failing one", async () => {
    vi.mocked(saveMappings)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ saved: 1, skipped: [] });
    const configs = { tcgplayer: {} } as unknown as MarketplaceConfigs;

    const result = await assignSuggestedListings(
      { access: ADMIN, transact, configs, input: {} },
      async () => LISTINGS,
    );

    expect(result).toEqual({ assigned: 1 });
    expect(saveMappings).toHaveBeenCalledTimes(2);
  });

  it("rejects non-admins", async () => {
    await expect(previewSuggestedListings(HELPER, async () => LISTINGS)).rejects.toMatchObject({
      status: 403,
    });
  });
});
