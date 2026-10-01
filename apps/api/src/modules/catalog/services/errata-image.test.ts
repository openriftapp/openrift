import { describe, expect, it } from "vitest";

import { defaultIo } from "../../../io.js";
import { renderErrataImage } from "./errata-image.js";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("renderErrataImage", () => {
  it("renders a 1200x630 PNG, with name tiles for cards whose art is missing", async () => {
    const png = await renderErrataImage(defaultIo, {
      cards: [
        { cardName: "Astral Heron", imageId: null },
        { cardName: "Diana, Lunari", imageId: "00000000-0000-0000-0000-000000000000" },
      ],
      cardCount: 64,
      updateCount: 4,
      siteHost: "openrift.app",
    });

    expect(png.subarray(0, 8)).toEqual(PNG_MAGIC);
    const meta = await defaultIo.sharp(png).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });

  it("renders at twice the size for the HQ scale", async () => {
    const png = await renderErrataImage(defaultIo, { cards: [], cardCount: 1, updateCount: 1 }, 2);

    const meta = await defaultIo.sharp(png).metadata();
    expect(meta.width).toBe(2400);
  });
});
