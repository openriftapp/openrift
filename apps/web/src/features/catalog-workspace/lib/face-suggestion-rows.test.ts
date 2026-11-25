import type { AdminPrintingImageResponse } from "@openrift/shared/types/api/admin";
import { beforeEach, describe, expect, it } from "vitest";

import { FACE_FIELDS } from "@/features/admin/lib/source-compare";
import {
  makeAdminCardDetail,
  makeAdminPrinting,
  makeCandidateCard,
  makeCandidatePrinting,
  resetIdCounter,
} from "@/test/factories";

import {
  buildFaceSuggestions,
  describeElsewhere,
  FACE_FIELDS_FOR_READING,
  faceCompareCandidates,
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
    needsLevels: false,
    quad: null,
    isActive: true,
    activateWhenRehosted: false,
    isReviewed: false,
    addedAt: "2026-01-01T00:00:00.000Z",
    uploadedByName: null,
    fileInUseElsewhere: false,
    rehostFailure: null,
    ...overrides,
  };
}

beforeEach(() => {
  resetIdCounter();
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
  });

  it("compares a source's set slug with the face's set slug, and undoes to the slug", () => {
    const source = makeCandidateCard({ provider: "provider-a" });
    const printing = makeAdminPrinting({
      id: "printing-1",
      faceId: "f1",
      setId: "019cfc3b-0369-7890-a450-7859471cc3f6",
      setSlug: "OGN",
    });
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [printing],
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: source.id,
          printingId: "printing-1",
          setId: "OGN",
        }),
        makeCandidatePrinting({
          candidateCardId: source.id,
          printingId: "printing-1",
          setId: "SFD",
        }),
      ],
    });

    const model = buildFaceSuggestions(detail, "f1", CONTEXT);

    expect(model.suggestions.filter((entry) => entry.field === "setId")).toEqual([
      expect.objectContaining({ proposed: "SFD", current: "OGN" }),
    ]);
  });

  it("counts a new image among a source's differences", () => {
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
  });

  it("marks contributor suggestions", () => {
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

  it("offers a contributor's same-art image", () => {
    const source = makeCandidateCard({ provider: "usersubmission" });
    const printing = makeAdminPrinting({ id: "printing-1", faceId: "f1" });
    const same = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "printing-1",
      imageUrl: "https://img.example/corrected.png",
      imageMatch: "same",
    });
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [printing],
      candidatePrintings: [same],
      printingImages: [image()],
    });

    const model = buildFaceSuggestions(detail, "f1", CONTEXT);

    expect(model.sourceImages.map((entry) => entry.url)).toEqual([
      "https://img.example/corrected.png",
    ]);
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

describe("FACE_FIELDS_FOR_READING", () => {
  it("lists every face field once, identity first and printed text last", () => {
    expect([...FACE_FIELDS_FOR_READING].toSorted()).toEqual([...FACE_FIELDS].toSorted());
    expect(FACE_FIELDS_FOR_READING.slice(0, 4)).toEqual([
      "shortCode",
      "publicCode",
      "setId",
      "language",
    ]);
    expect(FACE_FIELDS_FOR_READING.at(-1)).toBe("printedYear");
  });
});
