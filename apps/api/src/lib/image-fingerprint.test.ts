import { describe, expect, it } from "vitest";

import {
  classifyAgainstLive,
  classifyImageMatch,
  decodeFingerprint,
  differenceHash,
  encodeFingerprint,
  hammingDistance,
  MARK_STORED_HEIGHT,
  MARK_STORED_WIDTH,
  markDistance,
} from "./image-fingerprint.js";
import type { ImageFingerprint } from "./image-fingerprint.js";

const MARK_SIZE = MARK_STORED_WIDTH * MARK_STORED_HEIGHT;

function noiseMark(seed: number): Uint8Array {
  const mark = new Uint8Array(MARK_SIZE);
  let state = seed;
  for (let i = 0; i < MARK_SIZE; i++) {
    state = (state * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
    mark[i] = 200 + (state % 20);
  }
  return mark;
}

function stampedMark(base: Uint8Array): Uint8Array {
  const mark = Uint8Array.from(base);
  for (let y = 8; y < 26; y++) {
    for (let x = 18; x < 36; x++) {
      mark[y * MARK_STORED_WIDTH + x] = 20;
    }
  }
  return mark;
}

function fingerprint(overrides: Partial<ImageFingerprint> = {}): ImageFingerprint {
  return {
    landscape: false,
    hash: Uint8Array.from([0b1010_1010, 1, 2, 3, 4, 5, 6, 7]),
    mark: noiseMark(1),
    ...overrides,
  };
}

describe("encodeFingerprint / decodeFingerprint", () => {
  it("round-trips orientation, hash and mark crop", () => {
    const original = fingerprint({ landscape: true });
    expect(decodeFingerprint(encodeFingerprint(original))).toEqual(original);
  });

  it("rejects a payload of the wrong length or version", () => {
    expect(decodeFingerprint("AQA=")).toBeNull();
    const bytes = Buffer.from(encodeFingerprint(fingerprint()), "base64");
    bytes[0] = 9;
    expect(decodeFingerprint(bytes.toString("base64"))).toBeNull();
  });
});

describe("differenceHash", () => {
  it("sets a bit where the left pixel is darker than its right neighbour", () => {
    const grid = Uint8Array.from([0, 10, 5, 20, 20, 20]);
    const bits = differenceHash(grid, 3, 2);
    expect(bits).toEqual(Uint8Array.from([0b0001]));
  });
});

describe("hammingDistance", () => {
  it("counts differing bits across every byte", () => {
    expect(hammingDistance(Uint8Array.from([0b1111, 0]), Uint8Array.from([0b1010, 1]))).toBe(3);
  });
});

describe("markDistance", () => {
  it("reads two copies of the same crop as close, even when one is shifted", () => {
    const base = noiseMark(7);
    const shifted = new Uint8Array(MARK_SIZE);
    for (let y = 0; y < MARK_STORED_HEIGHT; y++) {
      shifted[y * MARK_STORED_WIDTH] = base[y * MARK_STORED_WIDTH] ?? 0;
      for (let x = 1; x < MARK_STORED_WIDTH; x++) {
        shifted[y * MARK_STORED_WIDTH + x] = base[y * MARK_STORED_WIDTH + x - 1] ?? 0;
      }
    }
    expect(markDistance(base, base)).toBe(0);
    expect(markDistance(base, shifted)).toBeLessThan(0.5);
  });

  it("reads a stamp drawn onto the crop as far", () => {
    const base = noiseMark(7);
    expect(markDistance(base, stampedMark(base))).toBeGreaterThan(1.3);
  });
});

describe("classifyImageMatch", () => {
  it("is same for identical fingerprints", () => {
    expect(classifyImageMatch(fingerprint(), fingerprint())).toBe("same");
  });

  it("is art when the orientation or the whole-image hash differs", () => {
    expect(classifyImageMatch(fingerprint(), fingerprint({ landscape: true }))).toBe("art");
    expect(
      classifyImageMatch(
        fingerprint(),
        fingerprint({ hash: Uint8Array.from([255, 255, 2, 3, 4, 5, 6, 7]) }),
      ),
    ).toBe("art");
  });

  it("is mark when only the bottom-centre crop differs", () => {
    expect(
      classifyImageMatch(fingerprint(), fingerprint({ mark: stampedMark(noiseMark(1)) })),
    ).toBe("mark");
  });
});

describe("classifyAgainstLive", () => {
  const same = encodeFingerprint(fingerprint());
  const stamped = encodeFingerprint(fingerprint({ mark: stampedMark(noiseMark(1)) }));
  const other = encodeFingerprint(
    fingerprint({ hash: Uint8Array.from([255, 255, 255, 3, 4, 5, 6, 7]) }),
  );

  it("returns null without a decodable candidate or any live fingerprint", () => {
    expect(classifyAgainstLive(null, [same])).toBeNull();
    expect(classifyAgainstLive("nope", [same])).toBeNull();
    expect(classifyAgainstLive(same, [null])).toBeNull();
  });

  it("is same when any live image matches", () => {
    expect(classifyAgainstLive(same, [other, null, same])).toBe("same");
  });

  it("prefers mark over art when no live image matches", () => {
    expect(classifyAgainstLive(stamped, [other, same])).toBe("mark");
    expect(classifyAgainstLive(other, [same, stamped])).toBe("art");
  });
});
