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
import { blockPrintingPicks, buildUndo, columnPicks, pickCount } from "./compare-picks";
import { buildCompareModel } from "./compare-rows";

beforeEach(() => {
  resetIdCounter();
});

describe("columnPicks", () => {
  it("collects every disagreeing card and printing field of one column", () => {
    const gallery = makeCandidateCard({
      provider: "gallery",
      name: "Lux, Lady of Dawn",
      might: 5,
    });
    const printing = makeAdminPrinting({ artist: "Sixmorevodka", rarity: "common" });
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: "Lux, Lady of Luminosity", might: 3 }),
      sources: [gallery],
      printings: [printing],
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: gallery.id,
          printingId: printing.id,
          artist: "Kudos Productions",
          rarity: "epic",
        }),
      ],
    });
    const model = buildCompareModel(detail, buildCompareColumns(detail, []));
    const picks = columnPicks(model, gallery.id);

    expect(picks.cardFields).toEqual([
      { field: "name", value: "Lux, Lady of Dawn" },
      { field: "might", value: 5 },
    ]);
    expect(picks.printingFields).toEqual([
      { printingId: printing.id, field: "rarity", value: "epic" },
      { printingId: printing.id, field: "artist", value: "Kudos Productions" },
    ]);
    expect(pickCount(picks)).toBe(4);
  });

  it("skips empty, agreeing and invalid cells", () => {
    const gallery = makeCandidateCard({
      provider: "gallery",
      name: "Lux, Lady of Luminosity",
      might: null,
      domains: ["moonlight"],
    });
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: "Lux, Lady of Luminosity", might: 3, domains: ["calm"] }),
      sources: [gallery],
    });
    const model = buildCompareModel(detail, buildCompareColumns(detail, []), {
      domains: ["calm", "fury"],
    });
    expect(columnPicks(model, gallery.id).cardFields).toEqual([]);
  });

  it("never picks the image row", () => {
    const gallery = makeCandidateCard({ provider: "gallery" });
    const printing = makeAdminPrinting();
    const detail = makeAdminCardDetail({
      sources: [gallery],
      printings: [printing],
      printingImages: [
        makeAdminPrintingImage({
          printingId: printing.id,
          originalUrl: "https://cdn.example.test/lux.png",
        }),
      ],
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: gallery.id,
          printingId: printing.id,
          imageUrl: "https://cdn.example.test/lux-alt.png",
        }),
      ],
    });
    const model = buildCompareModel(detail, buildCompareColumns(detail, []));
    const [block] = model.printingBlocks;
    if (!block) {
      throw new Error("expected a printing block");
    }
    expect(block.imageRow.differences).toBe(1);
    expect(blockPrintingPicks(block, gallery.id)).toEqual([]);
  });

  it("returns nothing for a column that is not in the model", () => {
    const detail = makeAdminCardDetail({ sources: [makeCandidateCard({ provider: "gallery" })] });
    const model = buildCompareModel(detail, buildCompareColumns(detail, []));
    expect(pickCount(columnPicks(model, "no-such-column"))).toBe(0);
  });
});

describe("buildUndo", () => {
  it("carries the previous site value back with a message naming the source", () => {
    const undo = buildUndo(
      { kind: "card", cardId: "card-1", field: "name" },
      "Lux, Lady of Luminosity",
      "Name",
      "gallery",
    );
    expect(undo).toEqual({
      target: { kind: "card", cardId: "card-1", field: "name" },
      value: "Lux, Lady of Luminosity",
      message: "Used Name from gallery",
    });
  });

  it("normalises a missing previous value to null", () => {
    expect(
      buildUndo(
        { kind: "printing", printingId: "p-1", field: "artist" },
        undefined,
        "Artist",
        "gallery",
      ).value,
    ).toBeNull();
  });
});
