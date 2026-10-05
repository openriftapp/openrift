import type { CardCandidate, Quad, RgbaImage } from "./types";

const CARD_WIDTH = 384;
const CARD_HEIGHT = 528;

export function blankFrame(width = CARD_WIDTH, height = CARD_HEIGHT): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(200);
  for (let index = 3; index < data.length; index += 4) {
    data[index] = 255;
  }
  return { data, width, height };
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Bilinear value noise: one seed lines up with itself under the aligned check, two seeds do not. */
export function cardTexture(seed: number): RgbaImage {
  const cellsX = 12;
  const cellsY = 16;
  const random = seededRandom(seed);
  const grid = Array.from({ length: (cellsX + 1) * (cellsY + 1) }, () => random());
  const image = blankFrame();
  for (let y = 0; y < CARD_HEIGHT; y++) {
    const gy = (y / CARD_HEIGHT) * cellsY;
    const y0 = Math.floor(gy);
    const fy = gy - y0;
    for (let x = 0; x < CARD_WIDTH; x++) {
      const gx = (x / CARD_WIDTH) * cellsX;
      const x0 = Math.floor(gx);
      const fx = gx - x0;
      const at = (cx: number, cy: number) => grid[cy * (cellsX + 1) + cx] ?? 0;
      const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
      const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
      const value = 30 + 200 * (top * (1 - fy) + bottom * fy);
      const index = (y * CARD_WIDTH + x) * 4;
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
    }
  }
  return image;
}

export function layCard(
  frame: RgbaImage,
  card: RgbaImage,
  box: { left: number; top: number; width: number; height: number },
): void {
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const source =
        (Math.floor((y / box.height) * card.height) * card.width +
          Math.floor((x / box.width) * card.width)) *
        4;
      frame.data.set(
        card.data.subarray(source, source + 4),
        ((box.top + y) * frame.width + box.left + x) * 4,
      );
    }
  }
}

/**
 * A card whose lower band carries a per-printing block over a shared base;
 * stamp 0 leaves the base untouched, giving two byte-identical printings.
 */
export function printingCard(stamp: number): RgbaImage {
  const width = CARD_WIDTH;
  const height = CARD_HEIGHT;
  const data = new Uint8ClampedArray(width * height * 4);
  // Inside TEXT_REGION, the fallback name band for an unknown card type.
  const top = height * 0.65;
  const bottom = height * 0.81;
  const left = width * 0.28;
  const right = width * 0.72;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 128 + 60 * Math.sin((2 * Math.PI * x) / 220) * Math.cos((2 * Math.PI * y) / 300);
      if (stamp > 0 && y >= top && y < bottom && x >= left && x < right) {
        // Windowed by half-sines: the glyph term must fade to zero at the band boundary.
        const acrossX = Math.sin((Math.PI * (x - left)) / (right - left));
        const acrossY = Math.sin((Math.PI * (y - top)) / (bottom - top));
        value +=
          90 * acrossX * acrossY * Math.sin((2 * Math.PI * stamp * (x - left)) / (right - left));
      }
      const index = (y * width + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return { data, width, height };
}

export function boxQuad(left: number, top: number, width: number, height: number): Quad {
  return [
    { x: left, y: top },
    { x: left + width, y: top },
    { x: left + width, y: top + height },
    { x: left, y: top + height },
  ];
}

export function outline(quad: Quad, score = 1): CardCandidate {
  return { quad, areaFraction: 0.1, score };
}
