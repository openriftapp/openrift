import { describe, expect, it } from "vitest";

import type { BoardDeps, BoardOptions } from "./board";
import {
  DEFAULT_BOARD_OPTIONS,
  boardOptionsFor,
  boardTiles,
  cropImage,
  detectOutlinesInPhoto,
  detectTiled,
  identifyBoard,
  outlinesFromTiles,
  readBoard,
  shrinkPhoto,
} from "./board";
import { SESSION_UNWARP_HEIGHT, SESSION_UNWARP_WIDTH } from "./session-options";
import { boxQuad, cardTexture, outline as outlineOf } from "./test-images";
import type { Quad, RgbaImage } from "./types";
import { unwarpCard } from "./unwarp";

const quad = (x: number, y: number, width = 60, height = 84): Quad => boxQuad(x, y, width, height);

const candidate = (q: Quad) => outlineOf(q);

describe("boardTiles", () => {
  it("covers the photo with half-overlapping tiles", () => {
    const tiles = boardTiles(1000, 600, 400);
    const xs = [...new Set(tiles.map((tile) => tile.x))];
    const ys = [...new Set(tiles.map((tile) => tile.y))];
    expect(xs.at(-1)).toBe(600);
    expect(ys.at(-1)).toBe(200);
    expect(xs.length).toBe(4);
    expect(ys.length).toBe(2);
  });

  it("uses one tile for a photo smaller than a tile", () => {
    expect(boardTiles(300, 200, 400)).toEqual([{ x: 0, y: 0, width: 300, height: 200 }]);
  });
});

describe("cropImage", () => {
  it("copies the tile's pixels", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4).map((_, index) => index);
    const crop = cropImage({ data, width: 4, height: 4 }, { x: 1, y: 2, width: 2, height: 1 });
    expect(crop.data).toEqual(data.slice(36, 44));
  });
});

describe("outlinesFromTiles", () => {
  const photo = { width: 1000, height: 600 };

  it("moves outlines into photo pixels", () => {
    const tile = { x: 300, y: 200, width: 400, height: 400 };
    const [outline] = outlinesFromTiles(photo, [{ tile, candidates: [candidate(quad(50, 50))] }]);
    expect(outline?.quad[0]).toEqual({ x: 350, y: 250 });
  });

  it("drops an outline cut by an inner tile edge but keeps one on the photo edge", () => {
    const inner = { x: 300, y: 200, width: 400, height: 400 };
    const corner = { x: 0, y: 0, width: 400, height: 400 };
    expect(
      outlinesFromTiles(photo, [{ tile: inner, candidates: [candidate(quad(0, 50))] }]),
    ).toEqual([]);
    expect(
      outlinesFromTiles(photo, [{ tile: corner, candidates: [candidate(quad(0, 50))] }]),
    ).toHaveLength(1);
  });
});

function texturedPhoto(width = 400, height = 300): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = 128 + 100 * Math.sin(x / 9) * Math.cos(y / 13);
      const index = (y * width + x) * 4;
      data.fill(value, index, index + 3);
      data[index + 3] = 255;
    }
  }
  return { data, width, height };
}

function cropOf(photo: RgbaImage, at: Quad): RgbaImage {
  const crop = unwarpCard(photo, at, SESSION_UNWARP_WIDTH, SESSION_UNWARP_HEIGHT, 0);
  if (!crop) {
    throw new Error("the test quad must unwarp");
  }
  return crop;
}

const OPTIONS: BoardOptions = {
  ...DEFAULT_BOARD_OPTIONS,
  topK: 2,
  confidentDistance: 0.3,
  rotationFallbackDistance: 0.4,
  rotationPairOnly: false,
};

// The embedder maps every crop to (1, 0), so each key sits at its requested distance.
function boardDeps(
  distances: Record<string, number>,
  fetchReference: BoardDeps["fetchReference"],
): BoardDeps {
  const keys = Object.keys(distances);
  const vectors = new Float32Array(keys.length * 2);
  keys.forEach((key, index) => {
    const cosine = 1 - (distances[key] ?? 2);
    vectors[index * 2] = cosine;
    vectors[index * 2 + 1] = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  });
  return {
    embedder: (_pixels, count) => {
      const out = new Float32Array(count * 2);
      for (let slot = 0; slot < count; slot++) {
        out[slot * 2] = 1;
      }
      return Promise.resolve(out);
    },
    bank: { keys, vectors },
    embedImageSize: 8,
    artKeyOf: (key) => key,
    fetchReference,
  };
}

describe("identifyBoard", () => {
  const photo = texturedPhoto();
  const at = quad(20, 20, 120, 168);
  const match = cropOf(photo, at);
  const unrelated = cardTexture(7);

  it("reads on past a reference that fails to load", async () => {
    const fetched: string[] = [];
    const cards = await identifyBoard(
      photo,
      [candidate(at), candidate(quad(220, 20, 120, 168))],
      boardDeps({ a: 0 }, (key) => {
        fetched.push(key);
        return Promise.reject(new Error("the server answered 500"));
      }),
      { ...OPTIONS, topK: 1 },
    );
    expect(cards).toEqual([]);
    expect(fetched).toEqual(["a", "a"]);
  });

  it("reads a card whose render clearly wins as confident", async () => {
    const cards = await identifyBoard(
      photo,
      [candidate(at)],
      boardDeps({ a: 0, b: 0.01 }, (key) => Promise.resolve(key === "a" ? match : unrelated)),
      OPTIONS,
    );
    expect(cards).toMatchObject([{ key: "a", confident: true, alternatives: [] }]);
  });

  it("a failed rival keeps the card in the picker", async () => {
    const cards = await identifyBoard(
      photo,
      [candidate(at)],
      boardDeps({ a: 0, b: 0.01 }, (key) =>
        key === "a" ? Promise.resolve(match) : Promise.reject(new Error("the server answered 500")),
      ),
      OPTIONS,
    );
    expect(cards).toMatchObject([{ key: "a", confident: false, alternatives: ["b"] }]);
  });

  it("offers rivals within the alternative band and leaves out weaker ones", async () => {
    const cards = await identifyBoard(
      photo,
      [candidate(at)],
      boardDeps({ a: 0, b: 0.01, c: 0.02 }, (key) =>
        Promise.resolve(key === "c" ? unrelated : match),
      ),
      { ...OPTIONS, topK: 3 },
    );
    expect(cards).toMatchObject([{ key: "a", confident: false, alternatives: ["b"] }]);
  });

  it("keeps a card that wins with a weak aligned score", async () => {
    const weak: RgbaImage = {
      ...match,
      data: match.data.map((value, index) =>
        index % 4 === 3 ? value : Math.round(value * 0.1 + (unrelated.data[index] ?? 0) * 0.9),
      ),
    };
    const cards = await identifyBoard(
      photo,
      [candidate(at)],
      boardDeps({ a: 0 }, () => Promise.resolve(weak)),
      { ...OPTIONS, topK: 1, aligned: { minScore: 0, minMargin: 0 } },
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]!.score).toBeLessThan(0.5);
  });

  it("embeds a card the tiles report several times once", async () => {
    const embedded = async (outlines: Quad[]) => {
      let calls = 0;
      const deps = boardDeps({ a: 0 }, () => Promise.resolve(match));
      const embedder = deps.embedder;
      const cards = await identifyBoard(
        photo,
        outlines.map((outline, index) => outlineOf(outline, 0.9 - index / 10)),
        {
          ...deps,
          embedder: (pixels, count) => {
            calls += count;
            return embedder(pixels, count);
          },
        },
        { ...OPTIONS, topK: 1 },
      );
      return { calls, cards };
    };

    const once = await embedded([at]);
    const thrice = await embedded([at, quad(22, 21, 120, 168), quad(18, 20, 121, 168)]);

    expect(thrice.calls).toBe(once.calls);
    expect(thrice.cards).toMatchObject([{ key: "a", quad: at }]);
  });

  it("keeps a card under a higher-scored outline that does not identify", async () => {
    const cards = await identifyBoard(
      photo,
      [outlineOf(quad(0, 0, 400, 300), 0.99), outlineOf(at, 0.5)],
      boardDeps({ a: 0 }, () => Promise.resolve(match)),
      { ...OPTIONS, topK: 1 },
    );

    expect(cards).toMatchObject([{ key: "a", quad: at }]);
  });

  it("widens the shortlist when the nearest render is far", async () => {
    const shortlisted = async (nearest: number) => {
      const fetched: string[] = [];
      await identifyBoard(
        photo,
        [candidate(at)],
        boardDeps({ a: nearest, b: nearest + 0.01, c: nearest + 0.02 }, (key) => {
          fetched.push(key);
          return Promise.resolve(match);
        }),
        { ...OPTIONS, topK: 1, wideTopK: 3 },
      );
      return fetched;
    };

    expect(await shortlisted(0.1)).toEqual(["a"]);
    expect(await shortlisted(DEFAULT_BOARD_OPTIONS.wideSearchDistance + 0.01)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("shrinkPhoto", () => {
  it("shrinks the long side to the target and returns the factor back", () => {
    const { image, factor } = shrinkPhoto(texturedPhoto(800, 400), 400);
    expect([image.width, image.height]).toEqual([400, 200]);
    expect(factor).toBe(2);
  });

  it("keeps a photo that already fits", () => {
    const photo = texturedPhoto(300, 200);
    expect(shrinkPhoto(photo, 400)).toEqual({ image: photo, factor: 1 });
  });
});

describe("detectOutlinesInPhoto", () => {
  it("detects on the shrunk photo and returns outlines in photo pixels", async () => {
    const seen = new Set<number>();
    const outlines = await detectOutlinesInPhoto(
      texturedPhoto(800, 400),
      (image) => {
        seen.add(image.width);
        return Promise.resolve([candidate(quad(10, 10))]);
      },
      400,
    );

    expect(Math.max(...seen)).toBe(400);
    expect(outlines.length).toBeGreaterThan(0);
    expect(outlines.map((outline) => outline.quad)).toContainEqual(quad(20, 20, 120, 168));
  });
});

describe("readBoard", () => {
  it("returns outlines found on the shrunk photo in photo pixels", async () => {
    const photo = texturedPhoto(2000, 1500);
    const found = quad(100, 100, 240, 336);
    const scaled = quad(125, 125, 300, 420);
    const cards = await readBoard(
      photo,
      (image) => Promise.resolve(image.width === 1600 ? [candidate(found)] : []),
      boardDeps({ a: 0 }, () => Promise.resolve(cropOf(photo, scaled))),
      { ...OPTIONS, topK: 1 },
    );
    expect(cards.map((read) => read.quad)).toEqual([scaled]);
    expect(cards[0]?.key).toBe("a");
  });
});

describe("detectTiled", () => {
  const blank = (width: number, height: number): RgbaImage => ({
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  });

  it("runs every tile plus the whole image and returns outlines in image pixels", async () => {
    const seen: { width: number; height: number }[] = [];
    const outlines = await detectTiled(
      blank(800, 400),
      (image) => {
        seen.push({ width: image.width, height: image.height });
        return Promise.resolve([candidate(quad(100, 100))]);
      },
      400,
    );

    expect(seen).toHaveLength(boardTiles(800, 400, 400).length + 1);
    expect(seen.at(-1)).toEqual({ width: 800, height: 400 });
    expect(outlines.map((outline) => outline.quad[0])).toContainEqual({ x: 300, y: 100 });
  });

  it("keeps both passes on an image smaller than one tile", async () => {
    let calls = 0;
    const outlines = await detectTiled(blank(300, 200), () => {
      calls++;
      return Promise.resolve([candidate(quad(10, 10))]);
    });

    expect(calls).toBe(2);
    expect(outlines).toHaveLength(2);
  });
});

describe("boardOptionsFor", () => {
  it("takes the bank's gates over the board defaults", () => {
    const options = boardOptionsFor(
      { confidentDistance: 0.2, rotationFallbackDistance: 0.3 },
      true,
    );

    expect(options).toEqual({
      ...DEFAULT_BOARD_OPTIONS,
      topK: 3,
      confidentDistance: 0.2,
      rotationFallbackDistance: 0.3,
      rotationPairOnly: true,
    });
  });

  it("ranks every rotation for a bank that is not canonical", () => {
    expect(
      boardOptionsFor({ confidentDistance: 0.2, rotationFallbackDistance: 0.3 }, false)
        .rotationPairOnly,
    ).toBe(false);
  });
});
