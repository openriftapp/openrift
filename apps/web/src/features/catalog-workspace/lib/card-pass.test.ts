import type { ReviewCard } from "@openrift/shared/contracts/admin/catalog-workspace";
import type { AdminPrintingImageResponse } from "@openrift/shared/types/api/admin";
import { beforeEach, describe, expect, it } from "vitest";

import {
  makeAdminCard,
  makeAdminCardDetail,
  makeAdminPrinting,
  makeCandidateCard,
  makeCandidatePrinting,
  makeProviderSetting,
  resetIdCounter,
} from "@/test/factories";

import {
  buildCardPass,
  imageOrigin,
  newPrintingGroups,
  nextUploadId,
  reviewNeighbor,
  seededPrintingDraft,
} from "./card-pass";
import type { PassFace } from "./card-pass";

const OPTIONS = { providerSettings: [], submissions: [], costKeywords: [], isAdmin: true };

beforeEach(() => {
  resetIdCounter();
});

describe("buildCardPass dismiss targets", () => {
  it("checks a row that differs on face and printing fields once and counts both", () => {
    const source = makeCandidateCard({ provider: "provider-a" });
    const printing = makeAdminPrinting({ id: "printing-1", faceId: "f1" });
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

    const { dismiss } = buildCardPass(detail, OPTIONS);

    expect(dismiss.candidatePrintingIds).toEqual([candidate.id]);
    expect(dismiss.suggestions).toBe(2);
  });

  it("includes differing card rows and leaves agreeing ones unchecked", () => {
    const card = makeAdminCard({ might: 3 });
    const differs = makeCandidateCard({ provider: "provider-a", might: 4 });
    const agrees = makeCandidateCard({ provider: "provider-b", might: 3 });
    const detail = makeAdminCardDetail({ card, sources: [differs, agrees] });

    const { dismiss } = buildCardPass(detail, OPTIONS);

    expect(dismiss.candidateCardIds).toEqual([differs.id]);
    expect(dismiss.suggestions).toBe(1);
  });

  it("never includes a contributor row", () => {
    const card = makeAdminCard({ might: 3 });
    const contributor = makeCandidateCard({ provider: "usersubmission", might: 5 });
    const printing = makeAdminPrinting({ id: "printing-1", faceId: "f1" });
    const proposal = makeCandidatePrinting({
      candidateCardId: contributor.id,
      printingId: "printing-1",
      artist: "Kudos Productions",
      size: "oversized",
    });
    const detail = makeAdminCardDetail({
      card,
      sources: [contributor],
      printings: [printing],
      candidatePrintings: [proposal],
    });

    const { dismiss } = buildCardPass(detail, OPTIONS);

    expect(dismiss).toEqual({ candidateCardIds: [], candidatePrintingIds: [], suggestions: 0 });
  });

  it("leaves out rows of a provider outside the helper's scope", () => {
    const card = makeAdminCard({ might: 3 });
    const inScope = makeCandidateCard({ provider: "provider-a", might: 4 });
    const outOfScope = makeCandidateCard({ provider: "provider-b", might: 5 });
    const printing = makeAdminPrinting({ id: "printing-1", faceId: "f1" });
    const outCandidate = makeCandidatePrinting({
      candidateCardId: outOfScope.id,
      printingId: "printing-1",
      artist: "Kudos Productions",
    });
    const detail = makeAdminCardDetail({
      card,
      sources: [inScope, outOfScope],
      printings: [printing],
      candidatePrintings: [outCandidate],
    });

    const { dismiss, card: cardModel } = buildCardPass(detail, {
      ...OPTIONS,
      isAdmin: false,
      providerSettings: [
        makeProviderSetting({ provider: "provider-a", helperReviewable: true }),
        makeProviderSetting({ provider: "provider-b", helperReviewable: false }),
      ],
    });

    expect(dismiss.candidateCardIds).toEqual([inScope.id]);
    expect(dismiss.candidatePrintingIds).toEqual([]);
    expect(cardModel.suggestions.map((suggestion) => suggestion.sourceLabel)).toEqual([
      "provider-a",
    ]);
  });

  it("lists each face and printing once, with pending work flagged", () => {
    const source = makeCandidateCard({ provider: "provider-a" });
    const front = makeAdminPrinting({ id: "printing-1", faceId: "f1", canonicalRank: 0 });
    const other = makeAdminPrinting({ id: "printing-2", faceId: "f1", canonicalRank: 1 });
    const candidate = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "printing-2",
      size: "oversized",
    });
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [front, other],
      candidatePrintings: [candidate],
    });

    const pass = buildCardPass(detail, OPTIONS);

    expect(pass.faces.map((entry) => entry.face.faceId)).toEqual(["f1"]);
    expect(pass.faces[0]?.pending).toBe(false);
    expect(pass.printings.map((entry) => [entry.printing.id, entry.pending])).toEqual([
      ["printing-1", false],
      ["printing-2", true],
    ]);
  });
});

describe("buildCardPass images", () => {
  const image = (overrides: Partial<AdminPrintingImageResponse>): AdminPrintingImageResponse => ({
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
    isActive: false,
    activateWhenRehosted: false,
    isReviewed: false,
    addedAt: "2026-01-01T00:00:00.000Z",
    uploadedByName: null,
    fileInUseElsewhere: false,
    rehostFailure: null,
    ...overrides,
  });
  const passFor = (images: AdminPrintingImageResponse[]) =>
    buildCardPass(
      makeAdminCardDetail({
        printings: [makeAdminPrinting({ id: "printing-1", faceId: "f1" })],
        printingImages: images,
      }),
      OPTIONS,
    ).faces[0];

  it("lists a waiting upload and leaves out a kept one", () => {
    const face = passFor([image({ id: "waiting" }), image({ id: "kept", isReviewed: true })]);

    expect(face?.uploads.map((entry) => entry.id)).toEqual(["waiting"]);
    expect(face?.pending).toBe(true);
  });

  it("flags a face whose image failed to rehost", () => {
    const face = passFor([
      image({
        activateWhenRehosted: true,
        rehostFailure: { attempts: 3, error: "timeout", lastAttemptAt: "2026-01-01T00:00:00Z" },
      }),
    ]);

    expect(face?.uploads).toEqual([]);
    expect(face?.failedRehosts.map((entry) => entry.id)).toEqual(["image-1"]);
    expect(face?.pending).toBe(true);
  });

  it("leaves a face quiet while its image is still queued without a failure", () => {
    const face = passFor([image({ activateWhenRehosted: true })]);

    expect(face?.pending).toBe(false);
  });
});

describe("imageOrigin", () => {
  const source = makeCandidateCard({ provider: "provider-a" });
  const detail = makeAdminCardDetail({
    sources: [source],
    candidatePrintings: [
      makeCandidatePrinting({
        candidateCardId: source.id,
        imageUrl: "https://img.example/listed.png",
      }),
    ],
  });

  it("names the source that listed the URL", () => {
    expect(
      imageOrigin(detail, { originalUrl: "https://img.example/listed.png", uploadedByName: null }),
    ).toBe("From provider-a");
  });

  it("falls back to the host of a URL no source lists", () => {
    expect(
      imageOrigin(detail, { originalUrl: "https://other.example/a/b.png", uploadedByName: null }),
    ).toBe("From other.example");
  });

  it("calls a file without a web URL an upload and names the uploader", () => {
    expect(imageOrigin(detail, { originalUrl: null, uploadedByName: null })).toBe("Uploaded");
    expect(imageOrigin(detail, { originalUrl: null, uploadedByName: "Renata" })).toBe(
      "Uploaded by Renata",
    );
  });
});

describe("newPrintingGroups", () => {
  it("makes one row for two sources reporting the same printing", () => {
    const a = makeCandidateCard({ provider: "provider-a" });
    const b = makeCandidateCard({ provider: "provider-b" });
    const first = makeCandidatePrinting({ candidateCardId: a.id });
    const second = makeCandidatePrinting({ candidateCardId: b.id });
    const detail = makeAdminCardDetail({
      sources: [a, b],
      candidatePrintings: [first, second],
      candidatePrintingGroups: [
        {
          mostCommonShortCode: "OGN-001",
          shortCodes: [first.id, second.id],
          expectedPrintingId: "OGN-001",
          language: "EN",
          suggestedPrintingId: null,
        },
      ],
    });

    const groups = newPrintingGroups(detail, new Set());

    expect(groups).toHaveLength(1);
    expect(groups[0]?.providers).toEqual(["provider-a", "provider-b"]);
    expect(groups[0]?.hasContributor).toBe(false);
  });

  it("skips linked candidates and hidden providers", () => {
    const a = makeCandidateCard({ provider: "provider-a" });
    const hidden = makeCandidateCard({ provider: "provider-b" });
    const detail = makeAdminCardDetail({
      sources: [a, hidden],
      candidatePrintings: [
        makeCandidatePrinting({ candidateCardId: a.id, printingId: "printing-1" }),
        makeCandidatePrinting({ candidateCardId: hidden.id }),
      ],
    });

    expect(newPrintingGroups(detail, new Set(["provider-b"]))).toEqual([]);
  });
});

describe("seededPrintingDraft", () => {
  it("leaves a contributor's printing for a human look", () => {
    const contributor = makeCandidateCard({ provider: "usersubmission" });
    const candidate = makeCandidatePrinting({ candidateCardId: contributor.id });
    const detail = makeAdminCardDetail({
      sources: [contributor],
      candidatePrintings: [candidate],
    });
    const [group] = newPrintingGroups(detail, new Set());

    expect(group?.hasContributor).toBe(true);
    expect(group && seededPrintingDraft(detail, group, {}, new Set()).ready).toBe(false);
  });
});

function reviewCard(cardSlug: string | null, cardName = "Vi, Destructive"): ReviewCard {
  return {
    key: cardSlug ?? `new:${cardName}`,
    cardSlug,
    cardName,
    hasContribution: false,
    providers: [],
    waitingSince: "2026-11-20T09:00:00.000Z",
    pending: {
      cardFields: [],
      newPrintings: 0,
      faces: 0,
      printings: 0,
      newImages: 0,
      failedImages: 0,
    },
  };
}

describe("nextUploadId", () => {
  const face = (...ids: string[]) => ({ uploads: ids.map((id) => ({ id })) }) as PassFace;
  const faces = [face("a", "b"), face(), face("c")];

  it("moves on within a face and into the next face", () => {
    expect(nextUploadId(faces, "a")).toBe("b");
    expect(nextUploadId(faces, "b")).toBe("c");
  });

  it("wraps from the last image to the first one left", () => {
    expect(nextUploadId(faces, "c")).toBe("a");
  });

  it("is null when no other image waits", () => {
    expect(nextUploadId([face("a")], "a")).toBeNull();
  });
});

describe("reviewNeighbor", () => {
  const cards = [reviewCard("ahri"), reviewCard(null, "Jinx"), reviewCard("vi")];

  it("steps forward and back through the list", () => {
    expect(reviewNeighbor(cards, "ahri", 1, 0)?.cardName).toBe("Jinx");
    expect(reviewNeighbor(cards, "vi", -1, 2)?.cardName).toBe("Jinx");
  });

  it("is null past either end", () => {
    expect(reviewNeighbor(cards, "vi", 1, 2)).toBeNull();
    expect(reviewNeighbor(cards, "ahri", -1, 0)).toBeNull();
  });

  it("steps from the slot a resolved card left behind", () => {
    const rest = [reviewCard("ahri"), reviewCard("vi")];
    expect(reviewNeighbor(rest, "jinx", 1, 1)?.cardSlug).toBe("vi");
    expect(reviewNeighbor(rest, "jinx", -1, 1)?.cardSlug).toBe("ahri");
    expect(reviewNeighbor(rest, "vi-2", 1, 2)).toBeNull();
  });

  it("opens the first card when the current one was never in the list", () => {
    expect(reviewNeighbor(cards, "lux", 1, -1)?.cardSlug).toBe("ahri");
    expect(reviewNeighbor(cards, "lux", -1, -1)).toBeNull();
  });
});
