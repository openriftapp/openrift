import { beforeEach, describe, expect, it } from "vitest";

import {
  makeAdminCard,
  makeAdminCardDetail,
  makeAdminPrinting,
  makeAdminPrintingImage,
  makeCandidateCard,
  makeCandidatePrinting,
  resetIdCounter,
} from "@/test/factories";

import { buildCompareColumns } from "./compare-columns";
import {
  buildCompareModel,
  isInvalidOption,
  printingBlockTitle,
  visibleRows,
} from "./compare-rows";

beforeEach(() => {
  resetIdCounter();
});

function modelFor(
  detail: ReturnType<typeof makeAdminCardDetail>,
  optionSets: Record<string, readonly string[]> = {},
) {
  return buildCompareModel(detail, buildCompareColumns(detail, []), optionSets);
}

describe("buildCompareModel card rows", () => {
  it("marks a source cell that disagrees with the site", () => {
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: "Lux, Lady of Luminosity", might: 3 }),
      sources: [makeCandidateCard({ provider: "gallery", name: "Lux, Lady of Dawn", might: 3 })],
    });
    const model = modelFor(detail);
    const nameRow = model.cardRows.find((row) => row.field === "name");
    const mightRow = model.cardRows.find((row) => row.field === "might");
    expect(nameRow?.cells[0]?.state).toBe("different");
    expect(mightRow?.cells[0]?.state).toBe("same");
    expect(model.differences).toBe(1);
  });

  it("marks an empty source cell rather than a disagreement", () => {
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ mightBonus: 2 }),
      sources: [makeCandidateCard({ provider: "gallery", mightBonus: null })],
    });
    const row = modelFor(detail).cardRows.find((entry) => entry.field === "mightBonus");
    expect(row?.cells[0]?.state).toBe("empty");
    expect(row?.differences).toBe(0);
  });

  it("marks a value outside the allowed options as invalid", () => {
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ domains: ["calm"] }),
      sources: [makeCandidateCard({ provider: "gallery", domains: ["moonlight"] })],
    });
    const row = modelFor(detail, { domains: ["calm", "fury", "order"] }).cardRows.find(
      (entry) => entry.field === "domains",
    );
    expect(row?.cells[0]?.state).toBe("invalid");
    expect(row?.differences).toBe(0);
  });

  it("flags the text fields that render as a diff", () => {
    const printing = makeAdminPrinting({ flavorText: "The light endures." });
    const source = makeCandidateCard({ provider: "gallery" });
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [printing],
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: source.id,
          printingId: printing.id,
          flavorText: "The light endures on.",
        }),
      ],
    });
    const row = modelFor(detail).printingBlocks[0]?.rows.find(
      (entry) => entry.field === "flavorText",
    );
    expect(row?.isText).toBe(true);
    expect(row?.cells[0]?.state).toBe("different");
  });
});

describe("buildCompareModel printing blocks", () => {
  it("gives every column a cell, empty where the source carries no row", () => {
    const withRow = makeCandidateCard({ provider: "gallery" });
    const without = makeCandidateCard({ provider: "playloltcg" });
    const printing = makeAdminPrinting({ artist: "Sixmorevodka" });
    const detail = makeAdminCardDetail({
      sources: [withRow, without],
      printings: [printing],
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: withRow.id,
          printingId: printing.id,
          artist: "Kudos Productions",
        }),
      ],
    });
    const block = modelFor(detail).printingBlocks[0];
    const row = block?.rows.find((entry) => entry.field === "artist");
    expect(row?.cells).toHaveLength(2);
    expect(row?.cells.find((cell) => cell.columnId === withRow.id)?.state).toBe("different");
    expect(row?.cells.find((cell) => cell.columnId === without.id)?.state).toBe("empty");
    expect(Object.keys(block?.candidateByColumn ?? {})).toEqual([withRow.id]);
  });

  it("treats a source image with the active image's original url as the same file", () => {
    const source = makeCandidateCard({ provider: "gallery" });
    const other = makeCandidateCard({ provider: "playloltcg" });
    const printing = makeAdminPrinting();
    const detail = makeAdminCardDetail({
      sources: [source, other],
      printings: [printing],
      printingImages: [
        makeAdminPrintingImage({
          printingId: printing.id,
          originalUrl: "https://cdn.example.test/lux.png",
          rehostedUrl: "https://media.example.test/lux.webp",
        }),
      ],
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: source.id,
          printingId: printing.id,
          imageUrl: "https://cdn.example.test/lux.png",
        }),
        makeCandidatePrinting({
          candidateCardId: other.id,
          printingId: printing.id,
          imageUrl: "https://cdn.example.test/lux-alt.png",
        }),
      ],
    });
    const imageRow = modelFor(detail).printingBlocks[0]?.imageRow;
    expect(imageRow?.siteImageUrl).toBe("https://media.example.test/lux.webp");
    expect(imageRow?.activeImageId).not.toBeNull();
    expect(imageRow?.cells.find((cell) => cell.columnId === source.id)?.isSameFile).toBe(true);
    expect(imageRow?.cells.find((cell) => cell.columnId === other.id)?.isSameFile).toBe(false);
    expect(imageRow?.differences).toBe(1);
  });

  it("treats a source image that matches the rehosted url as the same file", () => {
    const source = makeCandidateCard({ provider: "gallery" });
    const printing = makeAdminPrinting();
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [printing],
      printingImages: [
        makeAdminPrintingImage({
          printingId: printing.id,
          originalUrl: null,
          rehostedUrl: "https://media.example.test/lux.webp",
        }),
      ],
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: source.id,
          printingId: printing.id,
          imageUrl: "https://media.example.test/lux.webp",
        }),
      ],
    });
    expect(modelFor(detail).printingBlocks[0]?.imageRow.differences).toBe(0);
  });

  it("counts a block with no disagreement as collapsible", () => {
    const source = makeCandidateCard({ provider: "gallery" });
    const printing = makeAdminPrinting();
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [printing],
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: source.id,
          printingId: printing.id,
          setId: printing.setId,
          shortCode: printing.shortCode,
          publicCode: printing.publicCode,
        }),
      ],
    });
    expect(modelFor(detail).printingBlocks[0]?.differences).toBe(0);
  });

  it("lists live printings that no source carries", () => {
    const printing = makeAdminPrinting({ shortCode: "OGN-042", language: "de" });
    const detail = makeAdminCardDetail({ printings: [printing] });
    expect(modelFor(detail).printingsWithoutSources).toEqual(["OGN-042 · DE"]);
  });
});

describe("buildCompareModel only-in-sources groups", () => {
  it("groups unlinked rows by column with a summary", () => {
    const source = makeCandidateCard({ provider: "gallery" });
    const other = makeCandidateCard({ provider: "playloltcg" });
    const first = makeCandidatePrinting({
      candidateCardId: source.id,
      shortCode: "OGN-001",
      finish: "foil",
      rarity: "epic",
      artist: "Sixmorevodka",
    });
    const second = makeCandidatePrinting({
      candidateCardId: other.id,
      shortCode: "OGN-001",
      finish: "foil",
    });
    const detail = makeAdminCardDetail({
      sources: [source, other],
      candidatePrintings: [first, second],
      candidatePrintingGroups: [
        {
          mostCommonShortCode: "OGN-001",
          shortCodes: [first.id, second.id],
          expectedPrintingId: "OGN-001:foil",
          language: "en",
          suggestedPrintingId: null,
        },
      ],
    });
    const group = modelFor(detail).groupBlocks[0];
    expect(group?.title).toBe("OGN-001 · EN");
    expect(group?.cells).toHaveLength(2);
    expect(group?.cells[0]?.summary).toBe("epic · foil · standard");
    expect(group?.cells[0]?.rowCount).toBe(1);
  });

  it("counts a source that carries two rows in the same group", () => {
    const source = makeCandidateCard({ provider: "gallery" });
    const first = makeCandidatePrinting({ candidateCardId: source.id, finish: "foil" });
    const second = makeCandidatePrinting({ candidateCardId: source.id, finish: "nonfoil" });
    const detail = makeAdminCardDetail({
      sources: [source],
      candidatePrintings: [first, second],
      candidatePrintingGroups: [
        {
          mostCommonShortCode: "OGN-001",
          shortCodes: [first.id, second.id],
          expectedPrintingId: "OGN-001:foil",
          language: null,
          suggestedPrintingId: null,
        },
      ],
    });
    const group = modelFor(detail).groupBlocks[0];
    expect(group?.cells).toHaveLength(1);
    expect(group?.cells[0]?.rowCount).toBe(2);
    expect(group?.candidates).toHaveLength(2);
  });

  it("skips a group whose rows are already linked to a printing", () => {
    const source = makeCandidateCard({ provider: "gallery" });
    const printing = makeAdminPrinting();
    const linked = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: printing.id,
    });
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [printing],
      candidatePrintings: [linked],
      candidatePrintingGroups: [
        {
          mostCommonShortCode: "OGN-001",
          shortCodes: [linked.id],
          expectedPrintingId: "OGN-001",
          language: null,
          suggestedPrintingId: null,
        },
      ],
    });
    expect(modelFor(detail).groupBlocks).toEqual([]);
  });
});

describe("helpers", () => {
  it("titles a printing block with code, language and finish", () => {
    expect(
      printingBlockTitle(
        makeAdminPrinting({ shortCode: "OGN-001", language: "en", finish: "foil" }),
      ),
    ).toBe("OGN-001 · EN · foil");
  });

  it("appends markers to the block title", () => {
    expect(
      printingBlockTitle(
        makeAdminPrinting({ finish: "nonfoil", markerSlugs: ["prerelease", "stamped"] }),
      ),
    ).toBe("OGN-001 · EN · nonfoil + prerelease + stamped");
  });

  it("accepts any value when no options are known", () => {
    expect(isInvalidOption("rarity", "mythic", {})).toBe(false);
    expect(isInvalidOption("rarity", "mythic", { rarity: [] })).toBe(false);
    expect(isInvalidOption("rarity", "mythic", { rarity: ["common"] })).toBe(true);
  });

  it("keeps only rows with a disagreement on the differences filter", () => {
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: "Lux, Lady of Luminosity" }),
      sources: [makeCandidateCard({ provider: "gallery", name: "Lux, Lady of Dawn" })],
    });
    const rows = modelFor(detail).cardRows;
    expect(visibleRows(rows, true).map((row) => row.field)).toEqual(["name"]);
    expect(visibleRows(rows, false)).toHaveLength(rows.length);
  });
});
