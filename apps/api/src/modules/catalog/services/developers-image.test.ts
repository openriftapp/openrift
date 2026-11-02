import { describe, expect, it } from "vitest";

import { defaultIo } from "../../../io.js";
import { renderDevelopersImage } from "./developers-image.js";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("renderDevelopersImage", () => {
  it("renders a 1200x630 PNG, with a name tile when the card art is missing", async () => {
    const png = await renderDevelopersImage(defaultIo, {
      showcase: {
        imageId: "00000000-0000-0000-0000-000000000000",
        name: "Annie, Fiery",
        energy: 5,
        tags: ["Annie", "Noxus"],
        domains: ["fury"],
        rulesText: "Your spells and abilities deal 1 Bonus Damage.",
        publicCode: "OGS-001/024",
      },
      backdropImageIds: ["00000000-0000-0000-0000-000000000001"],
      stats: { cards: 1106, printings: 9041, sets: 13, languages: 5 },
      siteHost: "openrift.app",
    });

    expect(png.subarray(0, 8)).toEqual(PNG_MAGIC);
    const meta = await defaultIo.sharp(png).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });

  it("renders without a showcase card at twice the size for the HQ scale", async () => {
    const png = await renderDevelopersImage(
      defaultIo,
      {
        showcase: null,
        backdropImageIds: [],
        stats: { cards: 0, printings: 0, sets: 0, languages: 0 },
      },
      2,
    );

    const meta = await defaultIo.sharp(png).metadata();
    expect(meta.width).toBe(2400);
  });
});
