import type { AdminPrintingImageResponse } from "@openrift/shared/types/api/admin";
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
import { printingImageDisplayUrl } from "./printing-image-display-url";

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
    const submissions = buildAttentionSubmissions(detail, []);
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
    expect(buildAttentionSubmissions(detail, [])).toHaveLength(0);
  });

  it("reads an image for an unnumbered side without a photo as an image submission", () => {
    const card = makeAdminCard();
    const printing = makeAdminPrinting({ shortCode: "SFD", publicCode: "SFD", setSlug: "SFD" });
    const source = makeCandidateCard({
      name: card.name,
      types: card.types,
      domains: card.domains,
      might: card.might,
      energy: card.energy,
      power: card.power,
    });
    const detail = makeAdminCardDetail({
      card,
      sources: [source],
      printings: [printing],
      setTotals: { SFD: 221 },
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
          imageUrl: "https://cdn.test/buff.png",
          imageMatch: null,
        }),
      ],
    });
    const [submission] = buildAttentionSubmissions(detail, []);
    expect(submission?.kind).toBe("image");
    expect(submission?.groups.flatMap((group) => group.changes.map((c) => c.label))).toEqual([
      "Image",
    ]);
  });

  it("keeps a contributor's same-art image for a side that has a photo", () => {
    const card = makeAdminCard();
    const printing = makeAdminPrinting();
    const source = makeCandidateCard({
      name: card.name,
      types: card.types,
      domains: card.domains,
      might: card.might,
      energy: card.energy,
      power: card.power,
    });
    const detail = makeAdminCardDetail({
      card,
      sources: [source],
      printings: [printing],
      printingImages: [
        {
          printingId: printing.id,
          face: "front",
          originalUrl: "https://cdn.test/skewed.png",
          rehostedUrl: null,
          isActive: true,
        } as AdminPrintingImageResponse,
      ],
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
          imageUrl: "https://cdn.test/corrected.png",
          imageMatch: "same",
        }),
      ],
    });
    const [submission] = buildAttentionSubmissions(detail, []);
    expect(submission?.kind).toBe("image");
    expect(submission?.groups.flatMap((group) => group.changes.map((c) => c.label))).toEqual([
      "Image (same art)",
    ]);
  });

  it("records unchanged fields alongside the changes", () => {
    const card = makeAdminCard({ name: "Lux, Lady of Luminosity", might: 3 });
    const detail = makeAdminCardDetail({
      card,
      sources: [makeCandidateCard({ name: card.name, might: 5 })],
    });
    const group = buildAttentionSubmissions(detail, [])[0]?.groups[0];
    expect(group?.changes.map((change) => change.field)).toEqual(["might"]);
    expect(group?.unchangedFields).toContain("Name");
  });

  it("shows the card group with the lowest-ranked printing's active image", () => {
    const lead = makeAdminPrinting({ canonicalRank: 1 });
    const other = makeAdminPrinting({ canonicalRank: 2 });
    const image = (printingId: string, originalUrl: string, isActive = true) =>
      ({
        printingId,
        face: "front",
        originalUrl,
        rehostedUrl: null,
        isActive,
      }) as AdminPrintingImageResponse;
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: "Lux, Lady of Luminosity" }),
      sources: [makeCandidateCard({ name: "Lux, Lady of Light" })],
      printings: [other, lead],
      printingImages: [
        image(other.id, "https://cdn.test/other.png"),
        image(lead.id, "https://cdn.test/old.png", false),
        image(lead.id, "https://cdn.test/lead.png"),
      ],
    });
    expect(buildAttentionSubmissions(detail, [])[0]?.groups[0]?.imageUrl).toBe(
      "https://cdn.test/lead.png",
    );
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
    const groups = buildAttentionSubmissions(detail, [])[0]?.groups ?? [];
    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe("printing");
    expect(groups[0]?.printingId).toBe(printing.id);
    expect(groups[0]?.printingLabel).toBe(printing.expectedPrintingId);
    expect(groups[0]?.changes.map((change) => change.field)).toEqual(["artist"]);
  });

  it("does not diff a source value the accept transforms would turn into the live value", () => {
    const source = makeCandidateCard({ name: "Lux, Lady of Luminosity" });
    const printing = makeAdminPrinting({
      publicCode: "OGN-001/300",
      printedRulesText: "Deal −1 to a unit… _(Not a real effect.)_",
      flavorText: "“Light it up,” she said.",
    });
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: source.name }),
      sources: [source],
      printings: [printing],
      setTotals: { ogn: 300 },
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: source.id,
          printingId: printing.id,
          publicCode: "OGN-001",
          printedRulesText: "Deal -1 to a unit... (Not a real effect.)",
          flavorText: '"Light it up," she said.',
        }),
      ],
    });
    expect(buildAttentionSubmissions(detail, [])[0]?.groups ?? []).toEqual([]);
  });

  it("treats an unlinked candidate printing as a new printing group", () => {
    const source = makeCandidateCard({ name: "Lux, Lady of Luminosity" });
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: source.name }),
      sources: [source],
      candidatePrintings: [makeCandidatePrinting({ candidateCardId: source.id, printingId: null })],
    });
    const groups = buildAttentionSubmissions(detail, [])[0]?.groups ?? [];
    expect(groups[0]?.kind).toBe("new-printing");
    expect(groups[0]?.changes).toEqual([]);
  });

  it("compares a new printing with the closest existing printing in its language", () => {
    const source = makeCandidateCard({ name: "Lux, Lady of Luminosity" });
    const otherLanguage = makeAdminPrinting({ shortCode: "OGN-042-P", language: "FR" });
    const distant = makeAdminPrinting({
      shortCode: "OGN-007",
      artist: "Someone Else",
      rarity: "rare",
      canonicalRank: 0,
    });
    const near = makeAdminPrinting({
      shortCode: "OGN-042",
      publicCode: "OGN-042/300",
      markerSlugs: ["promo"],
      canonicalRank: 1,
    });
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: source.name }),
      sources: [source],
      printings: [otherLanguage, distant, near],
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: source.id,
          printingId: null,
          shortCode: "OGN-042-P",
          publicCode: "OGN-042-P",
        }),
      ],
    });
    const submission = buildAttentionSubmissions(detail, [])[0];
    const closest = submission?.groups[0]?.closest;
    expect(submission?.kind).toBe("new-printing");
    expect(closest?.printing.id).toBe(near.id);
    expect(closest?.differingLabels).toEqual(["Markers", "Public code"]);
    expect(closest?.rows.find((row) => row.field === "shortCode")).toMatchObject({
      incoming: "OGN-042",
      differs: false,
    });
  });

  it("has no closest printing when the card has none", () => {
    const source = makeCandidateCard({ name: "Lux, Lady of Luminosity" });
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: source.name }),
      sources: [source],
      candidatePrintings: [makeCandidatePrinting({ candidateCardId: source.id, printingId: null })],
    });
    expect(buildAttentionSubmissions(detail, [])[0]?.groups[0]?.closest).toBeNull();
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
    const submission = buildAttentionSubmissions(detail, [])[0];
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
    const blocks = buildAttentionSources(
      detail,
      [makeProviderSetting({ provider: "gallery", isFavorite: true })],
      [],
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.changedFields).toBe(1);
    expect(blocks[0]?.entries[0]?.groups[0]?.changes.map((change) => change.field)).toEqual([
      "name",
    ]);
  });

  it("groups every candidate row of one provider into a single block", () => {
    const card = makeAdminCard({ name: "Lux, Lady of Luminosity" });
    const detail = makeAdminCardDetail({
      card,
      sources: [
        makeCandidateCard({
          provider: "gallery",
          externalId: "gallery-en",
          name: "Lux, Lady of Light",
          checkedAt: null,
          submittedByName: null,
        }),
        makeCandidateCard({
          provider: "gallery",
          externalId: "gallery-de",
          name: card.name,
          checkedAt: null,
          submittedByName: null,
        }),
      ],
    });
    const blocks = buildAttentionSources(
      detail,
      [makeProviderSetting({ provider: "gallery", isFavorite: true })],
      [],
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.entries).toHaveLength(2);
    expect(blocks[0]?.candidateCardIds).toHaveLength(2);
    expect(blocks[0]?.changedFields).toBe(1);
    expect(blocks[0]?.entries.map((entry) => entry.changedFields)).toEqual([1, 0]);
  });

  it("keeps an unchecked source whose values all match, with no changes to show", () => {
    const card = makeAdminCard();
    const detail = makeAdminCardDetail({
      card,
      sources: [
        makeCandidateCard({
          provider: "gallery",
          name: card.name,
          checkedAt: null,
          submittedByName: null,
        }),
      ],
    });
    const blocks = buildAttentionSources(
      detail,
      [makeProviderSetting({ provider: "gallery", isFavorite: true })],
      [],
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.changedFields).toBe(0);
    expect(blocks[0]?.newPrintings).toBe(0);
    expect(blocks[0]?.entries[0]?.groups).toEqual([]);
  });

  it("skips an untrusted provider", () => {
    const detail = makeAdminCardDetail({
      sources: [makeCandidateCard({ provider: "playloltcg", checkedAt: null })],
    });
    expect(
      buildAttentionSources(
        detail,
        [makeProviderSetting({ provider: "playloltcg", isFavorite: false })],
        [],
      ),
    ).toEqual([]);
  });

  it("skips contributor sources, which get their own block", () => {
    const detail = makeAdminCardDetail({
      sources: [makeCandidateCard({ checkedAt: null })],
    });
    expect(
      buildAttentionSources(
        detail,
        [makeProviderSetting({ provider: "usersubmission", isFavorite: true })],
        [],
      ),
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
    const blocks = buildAttentionSources(
      detail,
      [makeProviderSetting({ provider: "gallery", isFavorite: true })],
      [],
    );
    expect(blocks[0]?.newPrintings).toBe(1);
    expect(blocks[0]?.changedFields).toBe(0);
  });
});

describe("buildAttentionSources image comparison", () => {
  function detailWith(imageMatch: "same" | "art" | "mark" | null) {
    const source = makeCandidateCard({
      provider: "gallery",
      checkedAt: null,
      submittedByName: null,
    });
    const printing = makeAdminPrinting();
    return makeAdminCardDetail({
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
          imageUrl: "https://mirror.example/lux.png",
          imageMatch,
        }),
      ],
    });
  }
  const settings = [makeProviderSetting({ provider: "gallery", isFavorite: true })];

  it("reads a rehosted copy of the live image as nothing differs", () => {
    const blocks = buildAttentionSources(detailWith("same"), settings, []);
    expect(blocks[0]?.changedFields).toBe(0);
  });

  it("labels a differing image by what differs", () => {
    const labels = (match: "art" | "mark" | null) => {
      const detail = detailWith(match);
      const image = {
        printingId: detail.printings[0]?.id ?? "",
        face: "front",
        originalUrl: "https://cdn.test/lux.png",
        rehostedUrl: null,
        isActive: true,
      } as AdminPrintingImageResponse;
      return buildAttentionSources(
        { ...detail, printingImages: [image] },
        settings,
        [],
      )[0]?.entries[0]?.groups[0]?.changes.map((change) => [change.kind, change.label]);
    };
    expect(labels("art")).toEqual([["image", "Image (different image)"]]);
    expect(labels("mark")).toEqual([["image", "Image (bottom mark differs)"]]);
    expect(labels(null)).toEqual([["image", "Image (not compared yet)"]]);
  });

  it("labels an image for a side without a photo as Image", () => {
    const change = buildAttentionSources(detailWith(null), settings, [])[0]?.entries[0]?.groups[0]
      ?.changes[0];
    expect(change?.label).toBe("Image");
  });

  it("shows a rehosted live image through its display url", () => {
    const detail = detailWith("art");
    const image = {
      printingId: detail.printings[0]?.id ?? "",
      face: "front",
      originalUrl: "https://cdn.test/lux.png",
      rehostedUrl: "/media/cards/lux",
      isActive: true,
      rotation: 0,
      needsTrim: false,
    } as AdminPrintingImageResponse;
    const change = buildAttentionSources({ ...detail, printingImages: [image] }, settings, [])[0]
      ?.entries[0]?.groups[0]?.changes[0];
    expect(change?.current).toBe(printingImageDisplayUrl(image));
    expect(change?.current).toMatch(/^\/media\/cards\/lux-full\.webp\?/u);
  });
});
