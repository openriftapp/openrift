/* oxlint-disable import/first -- vi.mock must precede the mocked imports */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repos, Transact } from "../../../deps.js";
import type { Io } from "../../../io.js";
import type { AdminAccess } from "../../../middleware/require-admin.js";
import type { MarketplaceConfigs } from "../../marketplace/lib/marketplace-configs.js";
import type { UnassignedListings } from "../../marketplace/lib/unassigned-listings.js";

vi.mock("../../catalog/services/printing-admin.js", () => ({
  acceptPrinting: vi.fn(),
}));
vi.mock("./accept-gallery.js", () => ({
  acceptFavoriteNewCard: vi.fn(),
}));
vi.mock("./relink-candidates.js", () => ({
  relinkCandidatePrintings: vi.fn(async () => ({ examined: 0, linked: 0 })),
}));
vi.mock("../../marketplace/services/marketplace-mapping.js", () => ({
  saveMappings: vi.fn(async () => ({ saved: 1, skipped: [] })),
}));

import { acceptPrinting } from "../../catalog/services/printing-admin.js";
import { saveMappings } from "../../marketplace/services/marketplace-mapping.js";
import { acceptFavoriteNewCard } from "./accept-gallery.js";
import { relinkCandidatePrintings } from "./relink-candidates.js";
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

function makeRepos(over: { printings?: unknown[]; probes?: unknown[] } = {}) {
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
    adminEvents: { insert: vi.fn(async () => {}) },
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
    });
    expect(repos.workspaceBatch.trustedNewCardDrafts).toHaveBeenCalledWith(["gallery"]);
  });

  it("accepts each draft, records an event per card and reports failures", async () => {
    vi.mocked(acceptFavoriteNewCard)
      .mockRejectedValueOnce(new Error("Card already exists"))
      .mockResolvedValueOnce({ cardSlug: "poro-herder", printingsCreated: 1, skipped: [] });
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
    expect(repos.catalog.refreshCatalogViews).toHaveBeenCalledTimes(1);
  });

  it("skips the view refresh when nothing was accepted", async () => {
    const repos = makeRepos();
    expect(await acceptTrustedCards(asRepos(repos), context())).toEqual({
      accepted: 0,
      skipped: [],
    });
    expect(repos.catalog.refreshCatalogViews).not.toHaveBeenCalled();
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
      distributionChannelSlugs: [],
    },
  ];

  it("previews groups that are complete and not duplicates", async () => {
    const repos = makeRepos({ printings, probes });
    expect(await previewTrustedPrintings(asRepos(repos), ADMIN)).toEqual({
      count: 1,
      items: [{ candidatePrintingId: "p1", cardSlug: "poro", label: "OGN-027 normal EN" }],
    });
  });

  it("accepts each group as new, records events and relinks once", async () => {
    vi.mocked(acceptPrinting).mockResolvedValueOnce("printing-1");
    const repos = makeRepos({ printings, probes });

    const result = await acceptTrustedPrintings(asRepos(repos), context());

    expect(result.accepted).toBe(1);
    expect(result.skipped).toEqual([
      { label: "poro OGN-030 normal EN", reason: "missing: rarity" },
      { label: "poro OGN-031 normal EN", reason: "possible duplicate of OGN-031" },
    ]);
    expect(acceptPrinting).toHaveBeenCalledWith(
      transact,
      repos,
      "card-1",
      expect.objectContaining({ shortCode: "OGN-027" }),
      ["p1", "p2"],
      io,
      { requireNew: true, secondFaceId: null },
    );
    expect(repos.adminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "printing.accept", entityId: "printing-1" }),
    );
    expect(repos.catalog.refreshCatalogViews).toHaveBeenCalledTimes(1);
    expect(relinkCandidatePrintings).toHaveBeenCalledTimes(1);
  });

  it("reports a conflict as skipped", async () => {
    vi.mocked(acceptPrinting).mockRejectedValueOnce(new Error("already has a printing"));
    const repos = makeRepos({ printings: [printing("p1")] });

    const result = await acceptTrustedPrintings(asRepos(repos), context());

    expect(result).toEqual({
      accepted: 0,
      skipped: [{ label: "poro OGN-027 normal EN", reason: "already has a printing" }],
    });
    expect(relinkCandidatePrintings).not.toHaveBeenCalled();
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
