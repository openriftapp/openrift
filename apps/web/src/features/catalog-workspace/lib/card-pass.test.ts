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
  placeNewPrintings,
  seededPrintingDraft,
  showsFaceOnStop,
} from "./card-pass";
import { buildFaceSuggestions } from "./face-suggestion-rows";

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
    expect(
      cardModel.rows.flatMap((row) => row.suggestions).map((suggestion) => suggestion.sourceLabel),
    ).toEqual(["provider-a"]);
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

describe("buildCardPass rows", () => {
  const waiting = (printingId: string, face: "front" | "back"): AdminPrintingImageResponse => ({
    id: `${printingId}-${face}`,
    printingId,
    imageFileId: `file-${printingId}-${face}`,
    face,
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
  });
  const summary = (rows: ReturnType<typeof buildCardPass>["rows"]) =>
    rows.map((row) => ({
      printing: row.entry.printing.id,
      faces: row.faces.map((face) => face.face.faceId),
      pending: row.pending,
    }));

  it("puts both faces of a two-faced printing on one row, pending when either face has work", () => {
    const detail = makeAdminCardDetail({
      printings: [
        makeAdminPrinting({ id: "printing-1", faceId: "f1", side: 1 }),
        makeAdminPrinting({ id: "printing-1", faceId: "f2", side: 2 }),
      ],
      printingImages: [waiting("printing-1", "back")],
    });

    expect(summary(buildCardPass(detail, OPTIONS).rows)).toEqual([
      { printing: "printing-1", faces: ["f1", "f2"], pending: true },
    ]);
  });

  it("shows a shared face on every printing that carries it", () => {
    const detail = makeAdminCardDetail({
      printings: [
        makeAdminPrinting({ id: "printing-1", faceId: "f1", canonicalRank: 0 }),
        makeAdminPrinting({ id: "printing-2", faceId: "f1", canonicalRank: 1 }),
      ],
      printingImages: [waiting("printing-1", "front")],
    });

    expect(summary(buildCardPass(detail, OPTIONS).rows)).toEqual([
      { printing: "printing-1", faces: ["f1"], pending: true },
      { printing: "printing-2", faces: ["f1"], pending: true },
    ]);
  });

  it("shows the reviewed card's face on its stop and another card's face only with work", () => {
    const quiet = makeAdminCardDetail({
      printings: [makeAdminPrinting({ id: "printing-1", faceId: "f1" })],
    });
    const busy = makeAdminCardDetail({
      printings: [makeAdminPrinting({ id: "printing-1", faceId: "f1" })],
      printingImages: [waiting("printing-1", "front")],
    });
    const context = { costKeywords: [], setTotals: {}, hiddenProviders: new Set<string>() };
    const quietModel = buildFaceSuggestions(quiet, "f1", context);
    const busyModel = buildFaceSuggestions(busy, "f1", context);

    expect(showsFaceOnStop("chaos-rune", quietModel, "chaos-rune")).toBe(true);
    expect(showsFaceOnStop("bird", quietModel, "chaos-rune")).toBe(false);
    expect(showsFaceOnStop("bird", busyModel, "chaos-rune")).toBe(true);
    expect(showsFaceOnStop("bird", buildFaceSuggestions(quiet, "missing", context))).toBe(false);
  });

  it("places a new printing after its closest listed printing and an unmatched one first", () => {
    const source = makeCandidateCard({ provider: "provider-a" });
    const listed = makeAdminPrinting({
      id: "printing-1",
      faceId: "f1",
      shortCode: "VEN-R05",
      language: "EN",
    });
    const near = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: null,
      shortCode: "VEN-R05",
      language: "EN",
    });
    const far = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: null,
      shortCode: "RAD-R05",
      language: "EN",
    });
    const detail = makeAdminCardDetail({ sources: [source], printings: [listed] });
    const row = (candidate: typeof near) => ({
      group: { key: candidate.id, candidates: [candidate], providers: [], hasContributor: false },
    });
    const pass = buildCardPass(detail, OPTIONS);

    const placed = placeNewPrintings(detail, pass.rows, [row(near), row(far)]);

    expect(placed.after.get("printing-1")?.map((entry) => entry.group.key)).toEqual([near.id]);
    expect(placed.ordered.map((entry) => entry.group.key)).toEqual([far.id, near.id]);
  });

  it("lists only this card's face on a printing paired with another card", () => {
    const detail = makeAdminCardDetail({
      printings: [
        makeAdminPrinting({
          id: "printing-1",
          faceId: "f1",
          side: 1,
          otherFace: {
            faceId: "other",
            cardName: "Bird",
            cardSlug: "bird",
            publicCode: "SGN-T01",
            imageUrl: null,
          },
        }),
      ],
    });

    expect(summary(buildCardPass(detail, OPTIONS).rows)).toEqual([
      { printing: "printing-1", faces: ["f1"], pending: false },
    ]);
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
