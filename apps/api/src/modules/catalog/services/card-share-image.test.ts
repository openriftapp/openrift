import { describe, expect, it } from "vitest";

import { defaultIo } from "../../../io.js";
import { renderCardShareImage } from "./card-share-image.js";
import type { CardShareImageInput } from "./card-share-input.js";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const INPUT: CardShareImageInput = {
  cardName: "Blazing Scorcher",
  typeLine: "Fury Unit",
  detailLine: "Origins · OGN-001 · Common",
  imageId: null,
  otherImageIds: ["00000000-0000-0000-0000-000000000000"],
  printingCount: 9,
  prices: [
    { label: "TCGplayer", value: "$0.24" },
    { label: "CardTrader", value: "€0.18" },
  ],
  siteHost: "openrift.app",
  shareUrl: "https://openrift.app/cards/blazing-scorcher/en-ogn-001-normal-standard",
};

describe("renderCardShareImage", () => {
  it("renders a 1200x630 PNG, with name tiles where the art is missing", async () => {
    const png = await renderCardShareImage(defaultIo, INPUT);

    expect(png.subarray(0, 8)).toEqual(PNG_MAGIC);
    const meta = await defaultIo.sharp(png).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });

  it("renders a single printing with no prices and no QR at twice the size", async () => {
    const png = await renderCardShareImage(
      defaultIo,
      { ...INPUT, otherImageIds: [], printingCount: 1, prices: [] },
      2,
      false,
    );

    const meta = await defaultIo.sharp(png).metadata();
    expect(meta.width).toBe(2400);
  });
});
