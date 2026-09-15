import { describe, expect, it, vi } from "vitest";

import {
  encodeFingerprint,
  MARK_STORED_HEIGHT,
  MARK_STORED_WIDTH,
} from "../../../lib/image-fingerprint.js";
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
  imageFingerprints: [] as (string | null)[],
};

function fingerprint(seed: number): string {
  const mark = new Uint8Array(MARK_STORED_WIDTH * MARK_STORED_HEIGHT);
  let state = seed;
  for (let i = 0; i < mark.length; i++) {
    state = (state * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
    mark[i] = 100 + (state % 100);
  }
  return encodeFingerprint({
    landscape: false,
    hash: Uint8Array.from([seed, 0, 0, 0, 0, 0, 0, 0]),
    mark,
  });
}

function pagedList<Row extends { id: string }>(rows: Row[]) {
  return vi.fn(async (_excludeProvider: string, afterId: string | null, limit: number) => {
    const start = afterId === null ? 0 : rows.findIndex((row) => row.id === afterId) + 1;
    return rows.slice(start, start + limit);
  });
}

function makeRepos<Card extends { id: string }, Printing extends { id: string }>(
  cards: Card[],
  printings: Printing[],
) {
  const listUncheckedCandidateCardsWithLive = pagedList(cards);
  const listUncheckedCandidatePrintingsWithLive = pagedList(printings);
  const checkCandidateCardsByIds = vi.fn(async (ids: string[]) => ids.length);
  const checkCandidatePrintingsByIds = vi.fn(async (ids: string[]) => ids.length);
  return {
    repos: {
      candidateCards: {
        listUncheckedCandidateCardsWithLive,
        listUncheckedCandidatePrintingsWithLive,
        checkCandidateCardsByIds,
        checkCandidatePrintingsByIds,
      },
      keywords: {
        listCostKeywords: vi.fn().mockResolvedValue([]),
      },
    } as never,
    listUncheckedCandidateCardsWithLive,
    listUncheckedCandidatePrintingsWithLive,
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

  it("checks a printing whose image lives at a new URL when its fingerprint matches a live image", async () => {
    const { repos, checkCandidatePrintingsByIds } = makeRepos(
      [],
      [
        {
          id: "rehosted-copy",
          candidate: {
            ...livePrinting,
            imageUrl: "https://mirror.example/annie-2026.png",
            imageFingerprint: fingerprint(1),
          },
          live: { ...livePrinting, imageFingerprints: [null, fingerprint(1)] },
        },
        {
          id: "other-image",
          candidate: {
            ...livePrinting,
            imageUrl: "https://mirror.example/annie-alt.png",
            imageFingerprint: fingerprint(255),
          },
          live: { ...livePrinting, imageFingerprints: [fingerprint(1)] },
        },
        {
          id: "not-fingerprinted",
          candidate: {
            ...livePrinting,
            imageUrl: "https://mirror.example/annie-3.png",
            imageFingerprint: null,
          },
          live: { ...livePrinting, imageFingerprints: [fingerprint(1)] },
        },
      ],
    );
    const result = await checkMatchingCandidates(repos, NOW);
    expect(checkCandidatePrintingsByIds).toHaveBeenCalledWith(["rehosted-copy"], NOW);
    expect(result.printingsChecked).toBe(1);
  });

  it("checks printings whose source values match once the accept transforms are applied", async () => {
    const { repos, checkCandidatePrintingsByIds } = makeRepos(
      [],
      [
        {
          id: "typography",
          printedTotal: 298,
          candidate: {
            ...livePrinting,
            publicCode: "OGN-001",
            printedRulesText: "Deal -1 to a unit... (Not a real effect.)",
            flavorText: '"Burn it all," she said.',
            imageUrl: null,
          },
          live: {
            ...livePrinting,
            printedRulesText: "Deal −1 to a unit… _(Not a real effect.)_",
            flavorText: "“Burn it all,” she said.",
          },
        },
        {
          id: "still-differs",
          printedTotal: 298,
          candidate: { ...livePrinting, publicCode: "OGN-001-EN", imageUrl: null },
          live: livePrinting,
        },
      ],
    );
    const result = await checkMatchingCandidates(repos, NOW);
    expect(checkCandidatePrintingsByIds).toHaveBeenCalledWith(["typography"], NOW);
    expect(result.printingsChecked).toBe(1);
  });

  it("excludes contributor submissions from the scan", async () => {
    const { repos, listUncheckedCandidateCardsWithLive, listUncheckedCandidatePrintingsWithLive } =
      makeRepos([], []);
    await checkMatchingCandidates(repos, NOW);
    expect(listUncheckedCandidateCardsWithLive).toHaveBeenCalledWith("usersubmission", null, 250);
    expect(listUncheckedCandidatePrintingsWithLive).toHaveBeenCalledWith(
      "usersubmission",
      null,
      250,
    );
  });

  it("walks every page and checks each page's matches as it goes", async () => {
    const same = { candidate: liveCard, live: liveCard };
    const differs = { candidate: { ...liveCard, might: 4 }, live: liveCard };
    const { repos, listUncheckedCandidateCardsWithLive, checkCandidateCardsByIds } = makeRepos(
      [
        { id: "a", ...differs },
        { id: "b", ...same },
        { id: "c", ...differs },
        { id: "d", ...differs },
        { id: "e", ...same },
      ],
      [],
    );

    const result = await checkMatchingCandidates(repos, NOW, 2);

    expect(listUncheckedCandidateCardsWithLive.mock.calls.map((call) => call[1])).toEqual([
      null,
      "b",
      "d",
    ]);
    expect(checkCandidateCardsByIds.mock.calls).toEqual([
      [["b"], NOW],
      [["e"], NOW],
    ]);
    expect(result.cardsChecked).toBe(2);
  });

  it("asks for one more page after a full last page", async () => {
    const same = { candidate: liveCard, live: liveCard };
    const { repos, listUncheckedCandidateCardsWithLive } = makeRepos(
      [
        { id: "a", ...same },
        { id: "b", ...same },
      ],
      [],
    );

    const result = await checkMatchingCandidates(repos, NOW, 2);

    expect(listUncheckedCandidateCardsWithLive.mock.calls.map((call) => call[1])).toEqual([
      null,
      "b",
    ]);
    expect(result.cardsChecked).toBe(2);
  });
});
