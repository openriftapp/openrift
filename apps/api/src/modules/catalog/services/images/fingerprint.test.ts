import sharp from "sharp";
import { describe, expect, it } from "vitest";

import type { Io } from "../../../../io.js";
import { classifyAgainstLive, decodeFingerprint } from "../../../../lib/image-fingerprint.js";
import { computeCandidateFingerprint, computeImageFingerprint } from "./fingerprint.js";

const io = { sharp } as unknown as Io;

interface CardOptions {
  width?: number;
  height?: number;
  seed?: number;
  stamp?: boolean;
}

async function cardImage({
  width = 372,
  height = 520,
  seed = 1,
  stamp = false,
}: CardOptions = {}): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3, 240);
  let state = seed;
  const block = 24;
  for (let by = 0; by < Math.floor((height * 0.55) / block); by++) {
    for (let bx = 0; bx < Math.floor(width / block); bx++) {
      state = (state * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
      const value = state % 256;
      for (let y = by * block + 20; y < (by + 1) * block + 20; y++) {
        for (let x = bx * block; x < (bx + 1) * block && x < width; x++) {
          const i = (y * width + x) * 3;
          pixels[i] = value;
          pixels[i + 1] = (value * 3) % 256;
          pixels[i + 2] = (value * 7) % 256;
        }
      }
    }
  }
  if (stamp) {
    for (let y = Math.round(height * 0.915); y < Math.round(height * 0.96); y++) {
      for (let x = Math.round(width * 0.47); x < Math.round(width * 0.53); x++) {
        const i = (y * width + x) * 3;
        pixels[i] = 20;
        pixels[i + 1] = 20;
        pixels[i + 2] = 20;
      }
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

describe("computeImageFingerprint", () => {
  it("reads a resized re-encode of the same image as the same", async () => {
    const original = await cardImage();
    const copy = await sharp(original).resize(300).jpeg({ quality: 70 }).toBuffer();
    const a = await computeImageFingerprint(io, original);
    const b = await computeImageFingerprint(io, copy);
    expect(classifyAgainstLive(b, [a])).toBe("same");
  });

  it("reads a different image as art and a stamped copy as mark", async () => {
    const base = await computeImageFingerprint(io, await cardImage());
    const other = await computeImageFingerprint(io, await cardImage({ seed: 99 }));
    const stamped = await computeImageFingerprint(io, await cardImage({ stamp: true }));
    expect(classifyAgainstLive(other, [base])).toBe("art");
    expect(classifyAgainstLive(stamped, [base])).toBe("mark");
  });

  it("records orientation and applies the requested quarter turn", async () => {
    const landscape = await cardImage({ width: 520, height: 372 });
    expect(decodeFingerprint(await computeImageFingerprint(io, landscape))?.landscape).toBe(true);
    expect(decodeFingerprint(await computeImageFingerprint(io, landscape, 90))?.landscape).toBe(
      false,
    );
  });
});

describe("computeCandidateFingerprint", () => {
  it("keeps the native orientation when it matches the live image or there is none", async () => {
    const portrait = await cardImage();
    const live = await computeImageFingerprint(io, portrait);
    expect(await computeCandidateFingerprint(io, portrait, live)).toBe(live);
    expect(await computeCandidateFingerprint(io, portrait, null)).toBe(live);
  });

  it("turns a portrait source to match a landscape live image", async () => {
    const landscape = await cardImage({ width: 520, height: 372 });
    const live = await computeImageFingerprint(io, landscape);
    const turned = await sharp(landscape).rotate(90).png().toBuffer();
    const candidate = await computeCandidateFingerprint(io, turned, live);
    expect(decodeFingerprint(candidate)?.landscape).toBe(true);
    expect(classifyAgainstLive(candidate, [live])).toBe("same");
  });
});
