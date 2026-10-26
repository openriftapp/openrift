import type { AdminPrintingImageResponse } from "@openrift/shared/types/api/admin";
import { beforeEach, describe, expect, it } from "vitest";

import {
  makeAdminCardDetail,
  makeAdminPrinting,
  makeCandidateCard,
  makeCandidatePrinting,
  resetIdCounter,
} from "@/test/factories";

import {
  buildFaceSuggestions,
  candidateBelongsToFace,
  describeElsewhere,
  discardedLabel,
  discardLabel,
  faceCompareCandidates,
  formatSuggestionValue,
  primaryLabel,
  submitterNameOf,
} from "./face-suggestion-rows";

const CONTEXT = { costKeywords: [], setTotals: {} };

function image(overrides: Partial<AdminPrintingImageResponse> = {}): AdminPrintingImageResponse {
  return {
    id: "image-1",
    printingId: "printing-1",
    imageFileId: "file-1",
    face: "front",
    originalUrl: "https://img.example/own.png",
    rehostedUrl: null,
    rotation: 0,
    needsTrim: false,
    quad: null,
    isActive: true,
    ...overrides,
  };
}

beforeEach(() => {
  resetIdCounter();
});

describe("discardLabel", () => {
  it("says Discard for one suggestion", () => {
    expect(discardLabel(1, "Provider B")).toBe("Discard");
  });

  it("names the count and the source when it checks several", () => {
    expect(discardLabel(2, "Provider B")).toBe("Discard 2 from Provider B");
  });

  it("names what else the row settles on another record", () => {
    expect(discardLabel(1, "Provider B", "1 image")).toBe("Discard (also settles 1 image)");
    expect(discardLabel(2, "Provider B", null)).toBe("Discard 2 from Provider B");
  });
});

describe("describeElsewhere", () => {
  it("is null when nothing is left elsewhere", () => {
    expect(describeElsewhere({})).toBeNull();
    expect(describeElsewhere({ faceFields: 0, images: 0 })).toBeNull();
  });

  it("joins the counts with their nouns", () => {
    expect(describeElsewhere({ printingFields: 1 })).toBe("1 printing field");
    expect(describeElsewhere({ faceFields: 2, images: 1 })).toBe("2 face fields and 1 image");
  });
});

describe("primaryLabel", () => {
  it("is plain Next when nothing is discarded", () => {
    expect(primaryLabel(0)).toBe("Next");
  });

  it("counts the discarded sources", () => {
    expect(primaryLabel(3)).toBe("Discard 3 & next");
  });
});

describe("candidateBelongsToFace", () => {
  const front = makeAdminPrinting({ id: "p1", side: 1, faceId: "f1", shortCode: "UNL-T02" });
  const back = makeAdminPrinting({ id: "p1", side: 2, faceId: "f2", shortCode: "UNL-T03" });

  it("rejects an unlinked candidate", () => {
    expect(candidateBelongsToFace(makeCandidatePrinting(), "f1", [front])).toBe(false);
  });

  it("accepts a candidate on a printing that shows the face once", () => {
    const candidate = makeCandidatePrinting({ printingId: "p1", shortCode: "anything" });
    expect(candidateBelongsToFace(candidate, "f1", [front])).toBe(true);
  });

  it("splits a printing with this card on both faces by short code", () => {
    const backCode = makeCandidatePrinting({ printingId: "p1", shortCode: "unl-t03" });
    expect(candidateBelongsToFace(backCode, "f2", [front, back])).toBe(true);
    expect(candidateBelongsToFace(backCode, "f1", [front, back])).toBe(false);
  });

  it("falls back to the front face when the code matches neither face", () => {
    const other = makeCandidatePrinting({ printingId: "p1", shortCode: "OGN-001" });
    expect(candidateBelongsToFace(other, "f1", [front, back])).toBe(true);
    expect(candidateBelongsToFace(other, "f2", [front, back])).toBe(false);
  });
});

describe("buildFaceSuggestions", () => {
  it("returns an empty model for a face the card does not have", () => {
    const model = buildFaceSuggestions(makeAdminCardDetail(), "missing", CONTEXT);
    expect(model.face).toBeNull();
    expect(model.suggestions).toEqual([]);
  });

  it("lists face-field differences and leaves printing-level fields out", () => {
    const source = makeCandidateCard({ provider: "provider-a" });
    const printing = makeAdminPrinting({ id: "printing-1", faceId: "f1", artist: "" });
    const candidate = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "printing-1",
      artist: "Kudos Productions",
      size: "oversized",
    });
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [printing],
      candidatePrintings: [candidate],
    });

    const model = buildFaceSuggestions(detail, "f1", CONTEXT);

    expect(model.suggestions.map((entry) => entry.field)).toEqual(["artist"]);
    expect(model.suggestions[0]).toMatchObject({
      provider: "provider-a",
      printingId: "printing-1",
      faceId: "f1",
      isContributor: false,
    });
    expect(model.sources).toEqual([
      expect.objectContaining({
        candidatePrintingId: candidate.id,
        differences: 1,
        elsewhere: "1 printing field",
      }),
    ]);
    expect(model.enterCandidateIds).toEqual([]);
  });

  it("checks a source on Enter when every difference it carries is on the face", () => {
    const source = makeCandidateCard({ provider: "provider-a" });
    const printing = makeAdminPrinting({ id: "printing-1", faceId: "f1", artist: "" });
    const candidate = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "printing-1",
      artist: "Kudos Productions",
      imageUrl: "https://img.example/new.png",
    });
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [printing],
      candidatePrintings: [candidate],
    });

    const model = buildFaceSuggestions(detail, "f1", CONTEXT);

    expect(model.sources[0]).toMatchObject({ differences: 2, elsewhere: null });
    expect(model.enterCandidateIds).toEqual([candidate.id]);
  });

  it("keeps a candidate whose only difference is printing-level out of Enter", () => {
    const source = makeCandidateCard({ provider: "provider-a" });
    const printing = makeAdminPrinting({ id: "printing-1", faceId: "f1" });
    const candidate = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "printing-1",
      size: "oversized",
    });
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [printing],
      candidatePrintings: [candidate],
    });

    expect(buildFaceSuggestions(detail, "f1", CONTEXT).enterCandidateIds).toEqual([]);
  });

  it("checks a matching source on Enter so it leaves the queue", () => {
    const source = makeCandidateCard({ provider: "provider-a" });
    const printing = makeAdminPrinting({ id: "printing-1", faceId: "f1" });
    const candidate = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "printing-1",
    });
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [printing],
      candidatePrintings: [candidate],
    });

    const model = buildFaceSuggestions(detail, "f1", CONTEXT);

    expect(model.suggestions).toEqual([]);
    expect(model.enterCandidateIds).toEqual([candidate.id]);
  });

  it("marks contributor suggestions and keeps them out of Enter", () => {
    const source = makeCandidateCard({ provider: "usersubmission" });
    const printing = makeAdminPrinting({ id: "printing-1", faceId: "f1", artist: "" });
    const candidate = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "printing-1",
      artist: "Kudos Productions",
    });
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [printing],
      candidatePrintings: [candidate],
    });

    const model = buildFaceSuggestions(detail, "f1", CONTEXT);

    expect(model.suggestions[0]?.isContributor).toBe(true);
    expect(model.enterCandidateIds).toEqual([]);
  });

  it("skips checked rows, hidden providers and the other card's sources", () => {
    const shown = makeCandidateCard({ provider: "provider-a" });
    const hidden = makeCandidateCard({ provider: "provider-h" });
    const printing = makeAdminPrinting({ id: "printing-1", faceId: "f1", artist: "" });
    const detail = makeAdminCardDetail({
      sources: [shown, hidden],
      printings: [printing],
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: shown.id,
          printingId: "printing-1",
          artist: "A",
          checkedAt: "2026-10-20T00:00:00.000Z",
        }),
        makeCandidatePrinting({
          candidateCardId: hidden.id,
          printingId: "printing-1",
          artist: "B",
        }),
        makeCandidatePrinting({
          candidateCardId: "other-card",
          printingId: "printing-1",
          artist: "C",
        }),
      ],
    });

    const model = buildFaceSuggestions(detail, "f1", {
      ...CONTEXT,
      hiddenProviders: new Set(["provider-h"]),
    });

    expect(model.suggestions).toEqual([]);
    expect(model.sources).toEqual([]);
  });

  it("offers a new source image and skips one the face already holds or marked same", () => {
    const source = makeCandidateCard({ provider: "provider-b" });
    const printing = makeAdminPrinting({ id: "printing-1", faceId: "f1" });
    const fresh = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "printing-1",
      imageUrl: "https://img.example/new.png",
    });
    const held = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "printing-1",
      imageUrl: "https://img.example/own.png",
    });
    const same = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "printing-1",
      imageUrl: "https://img.example/same.png",
      imageMatch: "same",
    });
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [printing],
      candidatePrintings: [fresh, held, same],
      printingImages: [image()],
    });

    const model = buildFaceSuggestions(detail, "f1", CONTEXT);

    expect(model.images).toHaveLength(1);
    expect(model.sourceImages.map((entry) => entry.url)).toEqual(["https://img.example/new.png"]);
    expect(model.sources.find((entry) => entry.candidatePrintingId === fresh.id)?.differences).toBe(
      1,
    );
  });

  it("reads the face's images from its own side of a double-faced printing", () => {
    const front = makeAdminPrinting({ id: "printing-1", side: 1, faceId: "f1" });
    const back = makeAdminPrinting({ id: "printing-1", side: 2, faceId: "f2" });
    const detail = makeAdminCardDetail({
      printings: [front, back],
      printingImages: [image({ id: "front" }), image({ id: "back", face: "back" })],
    });

    expect(buildFaceSuggestions(detail, "f2", CONTEXT).images.map((entry) => entry.id)).toEqual([
      "back",
    ]);
  });
});

describe("formatSuggestionValue", () => {
  const labels = {
    rarities: { rare: "Rare" },
    finishes: { foil: "Foil" },
    artVariants: {},
    cardSizes: {},
    languages: { FR: "French" },
    markers: { promo: "Promo" },
    channels: { "summoner-skirmish": "Organized play › Summoner Skirmish" },
  };

  it("reads enum slugs through their label map", () => {
    expect(formatSuggestionValue("rarity", "rare", labels)).toBe("Rare");
    expect(formatSuggestionValue("language", "FR", labels)).toBe("French");
  });

  it("joins list labels and keeps unknown slugs", () => {
    expect(formatSuggestionValue("markerSlugs", ["promo", "signed"], labels)).toBe("Promo, signed");
    expect(formatSuggestionValue("distributionChannelSlugs", ["summoner-skirmish"], labels)).toBe(
      "Organized play › Summoner Skirmish",
    );
  });

  it("says Empty for a missing value and formats booleans", () => {
    expect(formatSuggestionValue("artist", "", labels)).toBe("Empty");
    expect(formatSuggestionValue("isSigned", true, labels)).toBe("Yes");
  });
});

describe("submitterNameOf", () => {
  it("finds the contributor's name on whichever card holds the proposal", () => {
    const first = makeAdminCardDetail({ sources: [makeCandidateCard({ provider: "provider-a" })] });
    const proposal = makeCandidateCard({ submittedByName: "Poro Keeper" });
    const second = makeAdminCardDetail({ sources: [proposal] });
    expect(submitterNameOf([first, second], proposal.id)).toBe("Poro Keeper");
  });

  it("returns null for an unknown source or a nameless submitter", () => {
    const nameless = makeCandidateCard({ submittedByName: null });
    const detail = makeAdminCardDetail({ sources: [nameless] });
    expect(submitterNameOf([detail], nameless.id)).toBeNull();
    expect(submitterNameOf([detail], "missing")).toBeNull();
  });
});

describe("discardedLabel", () => {
  const sources = [
    {
      candidatePrintingId: "c1",
      candidateCardId: "s1",
      provider: "Provider A",
      isContributor: false,
      differences: 2,
      elsewhere: null,
    },
    {
      candidatePrintingId: "c2",
      candidateCardId: "s2",
      provider: "Provider B",
      isContributor: false,
      differences: 0,
      elsewhere: null,
    },
  ];

  it("counts the suggestions of the discarded rows and names their providers", () => {
    expect(discardedLabel(sources, ["c1"])).toBe("Discarded 2 suggestions from Provider A");
    expect(discardedLabel(sources, ["c1", "c2"])).toBe(
      "Discarded 2 suggestions from Provider A, Provider B",
    );
  });

  it("counts sources when the discarded rows differ nowhere on this record", () => {
    expect(discardedLabel(sources, ["c2"])).toBe("Discarded 1 source from Provider B");
  });

  it("drops the provider part for unknown rows", () => {
    expect(discardedLabel(sources, ["missing"])).toBe("Discarded 0 sources");
  });
});

describe("faceCompareCandidates", () => {
  it("keeps checked and open rows of the face and drops hidden providers and other faces", () => {
    const shown = makeCandidateCard({ provider: "provider-a" });
    const hidden = makeCandidateCard({ provider: "provider-hidden" });
    const front = makeAdminPrinting({ id: "p1", side: 1, faceId: "f1", shortCode: "UNL-T02" });
    const back = makeAdminPrinting({ id: "p1", side: 2, faceId: "f2", shortCode: "UNL-T03" });
    const open = makeCandidatePrinting({
      candidateCardId: shown.id,
      printingId: "p1",
      shortCode: "UNL-T02",
    });
    const checked = makeCandidatePrinting({
      candidateCardId: shown.id,
      printingId: "p1",
      shortCode: "UNL-T02",
      checkedAt: "2026-10-01T00:00:00.000Z",
    });
    const otherFace = makeCandidatePrinting({
      candidateCardId: shown.id,
      printingId: "p1",
      shortCode: "UNL-T03",
    });
    const hiddenRow = makeCandidatePrinting({
      candidateCardId: hidden.id,
      printingId: "p1",
      shortCode: "UNL-T02",
    });
    const detail = makeAdminCardDetail({
      sources: [shown, hidden],
      printings: [front, back],
      candidatePrintings: [open, checked, otherFace, hiddenRow],
    });

    expect(
      faceCompareCandidates(detail, "f1", new Set(["provider-hidden"])).map((row) => row.id),
    ).toEqual([open.id, checked.id]);
  });
});
