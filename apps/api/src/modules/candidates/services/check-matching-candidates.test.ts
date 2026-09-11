import { describe, expect, it, vi } from "vitest";

import { checkMatchingCandidates } from "./check-matching-candidates.js";

const NOW = new Date("2026-09-11T00:00:00Z");

const liveCard = {
  name: "Annie",
  types: ["unit"],
  superTypes: [],
  domains: ["fury"],
  might: 3,
  energy: 2,
  power: 1,
  mightBonus: null,
  tags: ["mage"],
};

const livePrinting = {
  shortCode: "OGN-001",
  setId: "ogn",
  rarity: "common",
  artVariant: "standard",
  isSigned: false,
  isOvernumbered: false,
  markerSlugs: ["a", "b"],
  distributionChannelSlugs: ["booster"],
  finish: "normal",
  size: "standard",
  artist: "Someone",
  publicCode: "OGN-001/298",
  printedRulesText: null,
  printedEffectText: null,
  flavorText: "Burn.",
  language: "EN",
  printedName: null,
  printedYear: 2025,
  imageUrls: ["https://source.example/annie.png", "https://cdn.example/annie.webp"],
};

function makeRepos(cards: unknown[], printings: unknown[]) {
  const listUncheckedCandidateCardsWithLive = vi.fn().mockResolvedValue(cards);
  const checkCandidateCardsByIds = vi.fn(async (ids: string[]) => ids.length);
  const checkCandidatePrintingsByIds = vi.fn(async (ids: string[]) => ids.length);
  return {
    repos: {
      candidateCards: {
        listUncheckedCandidateCardsWithLive,
        listUncheckedCandidatePrintingsWithLive: vi.fn().mockResolvedValue(printings),
        checkCandidateCardsByIds,
        checkCandidatePrintingsByIds,
      },
    } as never,
    listUncheckedCandidateCardsWithLive,
    checkCandidateCardsByIds,
    checkCandidatePrintingsByIds,
  };
}

describe("checkMatchingCandidates", () => {
  it("checks cards whose provided values equal the live card, treating missing values as same", async () => {
    const { repos, checkCandidateCardsByIds } = makeRepos(
      [
        { id: "same", candidate: { ...liveCard, might: null, tags: [] }, live: liveCard },
        { id: "differs", candidate: { ...liveCard, might: 4 }, live: liveCard },
        { id: "unmatched", candidate: liveCard, live: null },
      ],
      [],
    );
    const result = await checkMatchingCandidates(repos, NOW);
    expect(checkCandidateCardsByIds).toHaveBeenCalledWith(["same"], NOW);
    expect(result).toEqual({ cardsChecked: 1, printingsChecked: 0 });
  });

  it("checks printings whose provided values equal the linked printing", async () => {
    const { repos, checkCandidatePrintingsByIds } = makeRepos(
      [],
      [
        {
          id: "same",
          candidate: {
            ...livePrinting,
            markerSlugs: ["b", "a"],
            artist: null,
            imageUrl: "https://source.example/annie.png",
          },
          live: livePrinting,
        },
        {
          id: "no-image",
          candidate: { ...livePrinting, imageUrl: null },
          live: livePrinting,
        },
        {
          id: "other-image",
          candidate: { ...livePrinting, imageUrl: "https://elsewhere.example/x.png" },
          live: livePrinting,
        },
        {
          id: "differs",
          candidate: { ...livePrinting, rarity: "rare", imageUrl: null },
          live: livePrinting,
        },
      ],
    );
    const result = await checkMatchingCandidates(repos, NOW);
    expect(checkCandidatePrintingsByIds).toHaveBeenCalledWith(["same", "no-image"], NOW);
    expect(result).toEqual({ cardsChecked: 0, printingsChecked: 2 });
  });

  it("excludes contributor submissions from the scan", async () => {
    const { repos, listUncheckedCandidateCardsWithLive } = makeRepos([], []);
    await checkMatchingCandidates(repos, NOW);
    expect(listUncheckedCandidateCardsWithLive).toHaveBeenCalledWith("usersubmission");
  });
});
