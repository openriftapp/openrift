import { describe, expect, it } from "vitest";

import { alignedSignature } from "./aligned-verify";
import {
  groupArtworks,
  groupSharedIllustrations,
  illustrationCardKey,
  illustrationScore,
  SHARED_ILLUSTRATION_MIN_SCORE,
} from "./art-groups";
import type { EmbedBank } from "./embed";
import type { RgbaImage } from "./types";

function unit(angle: number, dim = 256): number[] {
  return [Math.cos(angle), Math.sin(angle), ...Array.from({ length: dim - 2 }, () => 0)];
}

function bankOf(entries: { key: string; vector: number[] }[]): EmbedBank {
  return {
    keys: entries.map((entry) => entry.key),
    vectors: new Float32Array(entries.flatMap((entry) => entry.vector)),
  };
}

const NAMES: Record<string, { name: string; type?: string }> = {
  "ogn-rune": { name: "Order Rune", type: "rune" },
  "sfd-rune": { name: "Order Rune", type: "rune" },
  "unl-rune": { name: "Order Rune", type: "rune" },
  "ogn-alt": { name: "Order Rune", type: "rune" },
  "ogn-ahri": { name: "Ahri", type: "unit" },
  "unl-ahri": { name: "Ahri", type: "unit" },
  "ogn-teemo": { name: "Teemo", type: "unit" },
};

const ART = new Map<string, string>([
  ["ogn-rune", "OGN|Order Rune|normal|"],
  ["sfd-rune", "SFD|Order Rune|normal|"],
  ["unl-rune", "UNL|Order Rune|normal|"],
  ["ogn-alt", "OGN|Order Rune|altart|"],
  ["ogn-ahri", "OGN|Ahri|normal|"],
  ["unl-ahri", "UNL|Ahri|normal|"],
  ["ogn-teemo", "OGN|Teemo|normal|"],
]);

function group(bank: EmbedBank, illustrations = new Map<string, string>()) {
  return groupArtworks(bank, ART, (key) => NAMES[key], illustrations);
}

describe("groupArtworks", () => {
  it("merges artworks of one card whose renders are near identical", () => {
    const bank = bankOf([
      { key: "ogn-rune", vector: unit(0) },
      { key: "sfd-rune", vector: unit(0.01) },
    ]);
    const { artKeys, groupOf } = group(bank);
    expect(artKeys.get("sfd-rune")).toBe("OGN|Order Rune|normal|");
    expect(artKeys.get("ogn-rune")).toBe("OGN|Order Rune|normal|");
    expect(groupOf.get("SFD|Order Rune|normal|")).toBe("OGN|Order Rune|normal|");
  });

  it("keeps renders further apart than the threshold separate", () => {
    const bank = bankOf([
      { key: "ogn-rune", vector: unit(0) },
      { key: "unl-rune", vector: unit(0.8) },
    ]);
    expect(group(bank).artKeys.get("unl-rune")).toBe("UNL|Order Rune|normal|");
  });

  it("never merges different cards, however close their renders", () => {
    const bank = bankOf([
      { key: "ogn-ahri", vector: unit(0) },
      { key: "ogn-teemo", vector: unit(0) },
    ]);
    expect(group(bank).artKeys.get("ogn-teemo")).toBe("OGN|Teemo|normal|");
  });

  it("merges transitively and names the group after its smallest artKey", () => {
    const bank = bankOf([
      { key: "sfd-rune", vector: unit(0) },
      { key: "unl-rune", vector: unit(0.25) },
      { key: "ogn-rune", vector: unit(0.5) },
    ]);
    const { artKeys } = group(bank);
    const groups = ["sfd-rune", "unl-rune", "ogn-rune"].map((key) => artKeys.get(key));
    expect(groups).toEqual([
      "OGN|Order Rune|normal|",
      "OGN|Order Rune|normal|",
      "OGN|Order Rune|normal|",
    ]);
  });

  it("never merges renders in a bank from an encoder other than the 256-d one", () => {
    const bank = bankOf([
      { key: "ogn-ahri", vector: unit(0, 512) },
      { key: "unl-ahri", vector: unit(0, 512) },
    ]);
    expect(group(bank).artKeys.get("unl-ahri")).toBe("UNL|Ahri|normal|");
  });

  it("leaves keys without an identity on their own artKey", () => {
    const bank = bankOf([
      { key: "ogn-rune", vector: unit(0) },
      { key: "sfd-rune", vector: unit(0) },
    ]);
    const { artKeys } = groupArtworks(
      bank,
      ART,
      (key) => (key === "sfd-rune" ? undefined : NAMES[key]),
      new Map(),
    );
    expect(artKeys.get("sfd-rune")).toBe("SFD|Order Rune|normal|");
  });

  it("applies shared illustrations before merging same-render artworks", () => {
    const bank = bankOf([
      { key: "unl-rune", vector: unit(0.8) },
      { key: "sfd-rune", vector: unit(0) },
      { key: "ogn-rune", vector: unit(0.01) },
    ]);
    const { artKeys, groupOf } = group(
      bank,
      new Map([["UNL|Order Rune|normal|", "SFD|Order Rune|normal|"]]),
    );
    expect(artKeys.get("unl-rune")).toBe("OGN|Order Rune|normal|");
    expect(groupOf.get("UNL|Order Rune|normal|")).toBe("OGN|Order Rune|normal|");
  });
});

describe("groupSharedIllustrations", () => {
  function texture(seed: number, gain = 1): RgbaImage {
    const width = 384;
    const height = 528;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value =
          128 +
          gain *
            (60 * Math.sin(x / (9 + seed)) * Math.cos(y / (13 + seed)) +
              30 * Math.sin((x + y) / 31));
        const index = (y * width + x) * 4;
        data[index] = value;
        data[index + 1] = value;
        data[index + 2] = value;
        data[index + 3] = 255;
      }
    }
    return { data, width, height };
  }

  it("groups two renders of one illustration and keeps another illustration apart", () => {
    const groups = groupSharedIllustrations([
      {
        artKey: "SFD|Mind Rune|altart|",
        card: "Mind Rune|rune",
        signature: alignedSignature(texture(0)),
      },
      {
        artKey: "UNL|Mind Rune|altart|",
        card: "Mind Rune|rune",
        signature: alignedSignature(texture(0, 0.8)),
      },
      {
        artKey: "OGN|Mind Rune|altart|",
        card: "Mind Rune|rune",
        signature: alignedSignature(texture(7)),
      },
    ]);
    expect(groups.get("UNL|Mind Rune|altart|")).toBe("SFD|Mind Rune|altart|");
    expect(groups.get("SFD|Mind Rune|altart|")).toBe("SFD|Mind Rune|altart|");
    expect(groups.get("OGN|Mind Rune|altart|")).toBe("OGN|Mind Rune|altart|");
  });

  it("groups two artwork keys when any of their renders share an illustration", () => {
    const groups = groupSharedIllustrations([
      {
        artKey: "UNL|Mind Rune|altart|",
        card: "Mind Rune|rune",
        signature: alignedSignature(texture(4)),
      },
      {
        artKey: "UNL|Mind Rune|altart|",
        card: "Mind Rune|rune",
        signature: alignedSignature(texture(0)),
      },
      {
        artKey: "SFD|Mind Rune|altart|",
        card: "Mind Rune|rune",
        signature: alignedSignature(texture(0, 0.8)),
      },
    ]);
    expect(groups.get("UNL|Mind Rune|altart|")).toBe("SFD|Mind Rune|altart|");
  });

  // Real reprints keep the frame and text box (bottom ~45%) and swap the art,
  // or keep the art and swap the text language.
  function card(art: RgbaImage, frame: RgbaImage, artShift = 0): RgbaImage {
    const { width, height } = art;
    const artRows = Math.round(height * 0.55);
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const source =
          y < artRows
            ? art.data[(y * width + Math.min(width - 1, x + artShift)) * 4]
            : frame.data[index];
        data[index] = source ?? 0;
        data[index + 1] = source ?? 0;
        data[index + 2] = source ?? 0;
        data[index + 3] = 255;
      }
    }
    return { data, width, height };
  }

  it("keeps an alternate art apart from the normal print it shares a frame and text with", () => {
    const normal = alignedSignature(card(texture(0), texture(5)));
    const altArt = alignedSignature(card(texture(7), texture(5)));
    const score = illustrationScore(normal, altArt);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeLessThan(0.7);
    const groups = groupSharedIllustrations([
      { artKey: "OGN|Sett, Kingpin|normal|", card: "Sett, Kingpin|unit", signature: normal },
      { artKey: "OGN|Sett, Kingpin|altart|", card: "Sett, Kingpin|unit", signature: altArt },
    ]);
    expect(groups.get("OGN|Sett, Kingpin|altart|")).toBe("OGN|Sett, Kingpin|altart|");
  });

  it("groups a token reprinted with the same art and a translated text box", () => {
    const english = alignedSignature(card(texture(0), texture(5)));
    const chinese = alignedSignature(card(texture(0, 0.8), texture(3), 2));
    expect(illustrationScore(english, chinese)).toBeGreaterThanOrEqual(
      SHARED_ILLUSTRATION_MIN_SCORE,
    );
    const groups = groupSharedIllustrations([
      { artKey: "SFD|Mech|normal|", card: "Mech|unit", signature: english },
      { artKey: "VEN|Mech|normal|", card: "Mech|unit", signature: chinese },
    ]);
    expect(groups.get("VEN|Mech|normal|")).toBe("SFD|Mech|normal|");
  });

  it("never groups artworks of different cards", () => {
    const groups = groupSharedIllustrations([
      { artKey: "OGN|Ahri|normal|", card: "Ahri|unit", signature: alignedSignature(texture(2)) },
      { artKey: "OGN|Teemo|normal|", card: "Teemo|unit", signature: alignedSignature(texture(2)) },
    ]);
    expect(groups.get("OGN|Teemo|normal|")).toBe("OGN|Teemo|normal|");
  });
});

describe("illustrationCardKey", () => {
  it("joins the card's name and type", () => {
    expect(illustrationCardKey("Jinx, Loose Cannon", "unit")).toBe("Jinx, Loose Cannon|unit");
  });

  it("keeps an untyped card apart from a typed one of the same name", () => {
    expect(illustrationCardKey("Fury Rune")).toBe("Fury Rune|");
    expect(illustrationCardKey("Fury Rune")).not.toBe(illustrationCardKey("Fury Rune", "rune"));
  });
});
