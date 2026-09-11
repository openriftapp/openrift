import { beforeEach, describe, expect, it } from "vitest";

import {
  resetIdCounter,
  makeAdminCard,
  makeAdminCardDetail,
  makeAdminPrinting,
  makeCandidateCard,
  makeCandidatePrinting,
  makeProviderSetting,
} from "@/test/factories";

import { buildAttentionSources, buildAttentionSubmissions } from "./attention-items";

beforeEach(() => {
  resetIdCounter();
});

describe("buildAttentionSubmissions", () => {
  it("lists only unchecked contributor sources", () => {
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: "Lux, Lady of Luminosity" }),
      sources: [
        makeCandidateCard({ name: "Lux, Lady of Light", checkedAt: null }),
        makeCandidateCard({ name: "Lux, Lady of Dawn", checkedAt: "2026-09-01T00:00:00.000Z" }),
        makeCandidateCard({ provider: "gallery", name: "Lux, Lady of Dusk", checkedAt: null }),
      ],
    });
    const submissions = buildAttentionSubmissions(detail);
    expect(submissions).toHaveLength(1);
    expect(submissions[0]?.groups[0]?.changes.map((change) => change.field)).toEqual(["name"]);
  });

  it("drops a submission whose every field already matches", () => {
    const card = makeAdminCard();
    const detail = makeAdminCardDetail({
      card,
      sources: [
        makeCandidateCard({
          name: card.name,
          types: card.types,
          domains: card.domains,
          might: card.might,
          energy: card.energy,
          power: card.power,
        }),
      ],
    });
    expect(buildAttentionSubmissions(detail)).toHaveLength(0);
  });

  it("records unchanged fields alongside the changes", () => {
    const card = makeAdminCard({ name: "Lux, Lady of Luminosity", might: 3 });
    const detail = makeAdminCardDetail({
      card,
      sources: [makeCandidateCard({ name: card.name, might: 5 })],
    });
    const group = buildAttentionSubmissions(detail)[0]?.groups[0];
    expect(group?.changes.map((change) => change.field)).toEqual(["might"]);
    expect(group?.unchangedFields).toContain("Name");
  });

  it("groups a linked candidate printing and diffs it against its printing", () => {
    const source = makeCandidateCard({ name: "Lux, Lady of Luminosity" });
    const printing = makeAdminPrinting({ artist: "Old Artist" });
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: source.name }),
      sources: [source],
      printings: [printing],
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: source.id,
          printingId: printing.id,
          artist: "New Artist",
        }),
      ],
    });
    const groups = buildAttentionSubmissions(detail)[0]?.groups ?? [];
    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe("printing");
    expect(groups[0]?.printingId).toBe(printing.id);
    expect(groups[0]?.printingLabel).toBe(printing.expectedPrintingId);
    expect(groups[0]?.changes.map((change) => change.field)).toEqual(["artist"]);
  });

  it("treats an unlinked candidate printing as a new printing group", () => {
    const source = makeCandidateCard({ name: "Lux, Lady of Luminosity" });
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: source.name }),
      sources: [source],
      candidatePrintings: [makeCandidatePrinting({ candidateCardId: source.id, printingId: null })],
    });
    const groups = buildAttentionSubmissions(detail)[0]?.groups ?? [];
    expect(groups[0]?.kind).toBe("new-printing");
    expect(groups[0]?.changes).toEqual([]);
  });

  it("calls a submission an image when only the image differs", () => {
    const source = makeCandidateCard({ name: "Lux, Lady of Luminosity" });
    const printing = makeAdminPrinting();
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: source.name }),
      sources: [source],
      printings: [printing],
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: source.id,
          printingId: printing.id,
          artist: printing.artist,
          publicCode: printing.publicCode,
          shortCode: printing.shortCode,
          setId: printing.setId,
          rarity: printing.rarity,
          artVariant: printing.artVariant,
          finish: printing.finish,
          size: printing.size,
          language: printing.language,
          printedYear: printing.printedYear,
          imageUrl: "https://example.test/lux.png",
        }),
      ],
    });
    const submission = buildAttentionSubmissions(detail)[0];
    expect(submission?.kind).toBe("image");
    expect(submission?.groups[0]?.changes.map((change) => change.kind)).toEqual(["image"]);
  });
});

describe("buildAttentionSources", () => {
  it("lists a trusted provider with unchecked rows", () => {
    const source = makeCandidateCard({
      provider: "gallery",
      name: "Lux, Lady of Light",
      checkedAt: null,
      submittedByName: null,
    });
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: "Lux, Lady of Luminosity" }),
      sources: [source],
    });
    const blocks = buildAttentionSources(detail, [
      makeProviderSetting({ provider: "gallery", isFavorite: true }),
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.changedFields).toBe(1);
  });

  it("skips an untrusted provider", () => {
    const detail = makeAdminCardDetail({
      sources: [makeCandidateCard({ provider: "playloltcg", checkedAt: null })],
    });
    expect(
      buildAttentionSources(detail, [
        makeProviderSetting({ provider: "playloltcg", isFavorite: false }),
      ]),
    ).toEqual([]);
  });

  it("skips contributor sources, which get their own block", () => {
    const detail = makeAdminCardDetail({
      sources: [makeCandidateCard({ checkedAt: null })],
    });
    expect(
      buildAttentionSources(detail, [
        makeProviderSetting({ provider: "usersubmission", isFavorite: true }),
      ]),
    ).toEqual([]);
  });

  it("counts unchecked new printings on a checked source", () => {
    const source = makeCandidateCard({
      provider: "gallery",
      checkedAt: "2026-09-01T00:00:00.000Z",
      submittedByName: null,
    });
    const detail = makeAdminCardDetail({
      sources: [source],
      candidatePrintings: [
        makeCandidatePrinting({ candidateCardId: source.id, printingId: null, checkedAt: null }),
      ],
    });
    const blocks = buildAttentionSources(detail, [
      makeProviderSetting({ provider: "gallery", isFavorite: true }),
    ]);
    expect(blocks[0]?.newPrintings).toBe(1);
    expect(blocks[0]?.changedFields).toBe(0);
  });
});
