import { describe, expect, it } from "vitest";

import {
  ALIGNED_HEIGHT,
  ALIGNED_WIDTH,
  REFERENCE_CACHE_LIMIT,
  alignedScore,
  alignedSignature,
  createAlignedVerifier,
  referenceSignature,
} from "./aligned-verify";
import type { RgbaImage } from "./types";

function image(width: number, height: number, pixel: (x: number, y: number) => number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = pixel(x, y);
      const index = (y * width + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return { data, width, height };
}

const pattern = (seed: number) => (x: number, y: number) =>
  128 + 100 * Math.sin((x + seed * 13) / 7) * Math.cos((y * (1 + seed) + seed * 5) / 9);

describe("alignedSignature", () => {
  it("shrinks a card to the thumbnail size", () => {
    const signature = alignedSignature(image(384, 528, pattern(1)));
    expect([signature.width, signature.height]).toEqual([ALIGNED_WIDTH, ALIGNED_HEIGHT]);
  });
});

describe("alignedScore", () => {
  it("scores the same picture near one", () => {
    const card = alignedSignature(image(384, 528, pattern(1)));
    expect(alignedScore(card, card)).toBeGreaterThan(0.95);
  });

  it("tolerates a small offset between crop and reference", () => {
    const reference = alignedSignature(image(384, 528, pattern(1)));
    const shifted = alignedSignature(image(384, 528, (x, y) => pattern(1)(x + 12, y + 8)));
    expect(alignedScore(shifted, reference)).toBeGreaterThan(0.85);
  });

  it("scores a different picture low", () => {
    const a = alignedSignature(image(384, 528, pattern(1)));
    const b = alignedSignature(image(384, 528, pattern(4)));
    expect(alignedScore(a, b)).toBeLessThan(0.5);
  });

  it("matches a card turned upside down once the query is rotated back", () => {
    const reference = alignedSignature(image(384, 528, pattern(2)));
    const upsideDown = image(384, 528, (x, y) => pattern(2)(383 - x, 527 - y));
    expect(alignedScore(alignedSignature(upsideDown, 2), reference)).toBeGreaterThan(0.95);
  });

  it("gives no verdict on a featureless image", () => {
    const flat = alignedSignature(image(384, 528, () => 128));
    expect(alignedScore(flat, flat)).toBeNaN();
  });
});

describe("referenceSignature", () => {
  it("keeps a portrait render upright", () => {
    const portrait = image(63, 88, pattern(1));
    expect(referenceSignature(portrait)).toEqual(alignedSignature(portrait, 0));
  });

  it("turns a landscape render 90 degrees left", () => {
    const landscape = image(88, 63, pattern(2));
    expect(referenceSignature(landscape)).toEqual(alignedSignature(landscape, 3));
  });
});

describe("createAlignedVerifier", () => {
  const card = image(384, 528, pattern(1));
  const shortlist = (...keys: string[]) => keys.map((key) => ({ key, rotation: 0 }));

  function verifierFetching(
    reference: (key: string) => Promise<RgbaImage | null>,
    cacheLimit?: number,
  ) {
    const fetched: string[] = [];
    const verify = createAlignedVerifier((key) => {
      fetched.push(key);
      return reference(key);
    }, cacheLimit);
    return { verify, fetched };
  }

  it("scores the card against each fetched render", async () => {
    const { verify } = verifierFetching((key) =>
      Promise.resolve(key === "same" ? card : image(384, 528, pattern(4))),
    );

    const { scores, failed } = await verify(card, shortlist("same", "other"));

    expect(failed).toEqual([]);
    expect(scores.map((entry) => entry.key)).toEqual(["same", "other"]);
    expect(scores[0]?.score).toBeGreaterThan(0.95);
    expect(scores[1]?.score).toBeLessThan(0.5);
  });

  it("caches a definitively missing render, so it costs one request", async () => {
    const { verify, fetched } = verifierFetching(() => Promise.resolve(null));

    await verify(card, shortlist("k-a"));
    const second = await verify(card, shortlist("k-a"));

    expect(fetched).toEqual(["k-a"]);
    expect(second).toEqual({ scores: [], failed: [] });
  });

  it("does not cache a transient failure, so a later frame retries it", async () => {
    const { verify, fetched } = verifierFetching(() =>
      Promise.reject(new Error("connection dropped")),
    );

    await verify(card, shortlist("k-a"));
    await verify(card, shortlist("k-a"));

    expect(fetched).toEqual(["k-a", "k-a"]);
  });

  it("names the shortlist members whose render could not be fetched", async () => {
    const { verify } = verifierFetching((key) =>
      key === "k-b" ? Promise.reject(new Error("connection dropped")) : Promise.resolve(card),
    );

    const { scores, failed } = await verify(card, shortlist("k-a", "k-b"));

    expect(failed).toEqual(["k-b"]);
    expect(scores.map((entry) => entry.key)).toEqual(["k-a"]);
  });

  it("fetches a cached render only once", async () => {
    const { verify, fetched } = verifierFetching(() => Promise.resolve(card));

    await verify(card, shortlist("k-a"));
    await verify(card, shortlist("k-a"));

    expect(fetched).toEqual(["k-a"]);
  });

  it("fetches the shortlist's references at the same time", async () => {
    let inFlight = 0;
    let mostInFlight = 0;
    const { verify } = verifierFetching(async () => {
      inFlight++;
      mostInFlight = Math.max(mostInFlight, inFlight);
      await Promise.resolve();
      inFlight--;
      return card;
    });

    await verify(card, shortlist("k-a", "k-b", "k-c"));

    expect(mostInFlight).toBe(3);
  });

  it("evicts the least recently used render past the cache limit", async () => {
    const { verify, fetched } = verifierFetching(() => Promise.resolve(null), 3);

    await verify(card, shortlist("k-0", "k-1", "k-2"));
    await verify(card, shortlist("k-0"));
    fetched.length = 0;
    await verify(card, shortlist("k-new"));
    await verify(card, shortlist("k-0"));
    await verify(card, shortlist("k-1"));

    expect(fetched).toEqual(["k-new", "k-1"]);
  });

  it("keeps a cached render that a newer shortlist entry evicts mid-frame", async () => {
    const keys = Array.from({ length: REFERENCE_CACHE_LIMIT }, (_, index) => `k-${index}`);
    const { verify, fetched } = verifierFetching((key) =>
      Promise.resolve(key === "k-0" ? card : null),
    );

    await verify(card, shortlist(...keys));
    const evicting = await verify(card, shortlist("k-new", "k-0"));
    fetched.length = 0;
    const alone = await verify(card, shortlist("k-0"));

    expect(evicting.scores.map((entry) => entry.key)).toEqual(["k-0"]);
    expect(fetched).toEqual([]);
    expect(alone.scores.map((entry) => entry.key)).toEqual(["k-0"]);
  });
});
