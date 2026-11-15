import { describe, expect, it, vi } from "vitest";

import { candidatePrintingRow } from "../../../test/candidate-printing-row.js";
import { assertFavoriteNewCardEligible } from "./trusted-accept-checks.js";

function makeRepos(over: { printings?: unknown[]; liveCards?: unknown[] } = {}) {
  return {
    candidateCards: {
      candidateCardsByNormName: vi.fn(async () => [
        {
          id: "cc-1",
          provider: "gallery",
          normName: "poroherder",
          name: "Poro Herder",
          types: ["unit"],
        },
        { id: "cc-2", provider: "other", normName: "poroherder", name: "Poro Herder", types: [] },
      ]),
      listCardsForSourceList: vi.fn(async () => over.liveCards ?? []),
      acceptableCandidatePrintings: vi.fn(
        async () => over.printings ?? [candidatePrintingRow("p1")],
      ),
    },
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
  };
}

const FAVORITES = new Set(["gallery"]);

describe("assertFavoriteNewCardEligible", () => {
  it("lets a complete favorite source with no similar card through", async () => {
    const repos = makeRepos();
    await expect(
      assertFavoriteNewCardEligible(repos as never, "poroherder", FAVORITES),
    ).resolves.toBeUndefined();
    expect(repos.candidateCards.acceptableCandidatePrintings).toHaveBeenCalledWith(["cc-1"]);
  });

  it("refuses a name a live card already resembles, with the batch's reason", async () => {
    const repos = makeRepos({
      liveCards: [{ id: "card-1", slug: "poro-herder-elite", name: "Poro Herder Elite" }],
    });
    await expect(
      assertFavoriteNewCardEligible(repos as never, "poroherder", FAVORITES),
    ).rejects.toMatchObject({
      status: 400,
      message: "Not accepted: a similar card exists: Poro Herder Elite",
    });
  });

  it("refuses a source without a complete printing", async () => {
    const repos = makeRepos({ printings: [candidatePrintingRow("p1", { rarity: null })] });
    await expect(
      assertFavoriteNewCardEligible(repos as never, "poroherder", FAVORITES),
    ).rejects.toThrow("Not accepted: no printing has every required field");
  });

  it("refuses a source whose complete printings name unknown values", async () => {
    const repos = makeRepos({ printings: [candidatePrintingRow("p1", { finish: "glossy" })] });
    await expect(
      assertFavoriteNewCardEligible(repos as never, "poroherder", FAVORITES),
    ).rejects.toThrow('Not accepted: not on an admin list: finish "glossy"');
  });

  it("leaves a name without favorite sources to the accept's own not-found answer", async () => {
    const repos = makeRepos();
    await expect(
      assertFavoriteNewCardEligible(repos as never, "poroherder", new Set(["elsewhere"])),
    ).resolves.toBeUndefined();
    expect(repos.candidateCards.listCardsForSourceList).not.toHaveBeenCalled();
  });
});
