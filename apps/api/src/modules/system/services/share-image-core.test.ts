import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Io } from "../../../io.js";
import { defaultIo } from "../../../io.js";
import {
  CARD_RADIUS_FRACTION,
  artFailureLog,
  cardRadiusPx,
  elideTitle,
  tileArtDataUri,
} from "./share-image-core.js";

const warn = vi.hoisted(() => vi.fn());
vi.mock("@openrift/shared/logger", () => ({ createLogger: () => ({ warn }) }));

describe("cardRadiusPx", () => {
  it("rounds to 5% of the tile's short edge", () => {
    expect(cardRadiusPx(100, 140)).toBe(5);
    expect(cardRadiusPx(200, 280)).toBe(10);
  });

  it("uses the short edge for landscape (battlefield) tiles", () => {
    expect(cardRadiusPx(280, 200)).toBe(10);
    expect(cardRadiusPx(140, 100)).toBe(5);
  });

  it("matches the exported fraction", () => {
    expect(cardRadiusPx(1000, 1000)).toBe(Math.round(1000 * CARD_RADIUS_FRACTION));
  });

  it("rounds to the nearest whole pixel", () => {
    expect(cardRadiusPx(63, 88)).toBe(3);
  });
});

describe("tileArtDataUri", () => {
  async function landscapeArtIo(): Promise<Io> {
    const half = { width: 50, height: 70, channels: 3 } as const;
    const art = await defaultIo
      .sharp({ create: { width: 100, height: 70, channels: 3, background: "#ff0000" } })
      .composite([
        {
          input: { create: { ...half, background: "#0000ff" } },
          left: 50,
          top: 0,
        },
      ])
      .webp({ lossless: true })
      .toBuffer();
    return { ...defaultIo, fs: { ...defaultIo.fs, readFile: (async () => art) as never } };
  }

  async function decode(dataUri: string | null) {
    const png = Buffer.from(dataUri?.split(",")[1] ?? "", "base64");
    return defaultIo.sharp(png).raw().toBuffer({ resolveWithObject: true });
  }

  function pixel(raw: Awaited<ReturnType<typeof decode>>, x: number, y: number) {
    const offset = (y * raw.info.width + x) * raw.info.channels;
    return [...raw.data.subarray(offset, offset + 3)];
  }

  it("turns landscape art -90° to fill a portrait tile, like the web app", async () => {
    const raw = await decode(
      await tileArtDataUri(await landscapeArtIo(), "id", 72, 102, 1, artFailureLog("test")),
    );
    expect(raw.info.width).toBeLessThan(raw.info.height);
    expect(pixel(raw, 35, 20)).toEqual([0, 0, 255]);
    expect(pixel(raw, 35, 80)).toEqual([255, 0, 0]);
  });

  it("keeps landscape art upright in a landscape tile", async () => {
    const raw = await decode(
      await tileArtDataUri(await landscapeArtIo(), "id", 102, 72, 1, artFailureLog("test")),
    );
    expect(pixel(raw, 20, 35)).toEqual([255, 0, 0]);
    expect(pixel(raw, 80, 35)).toEqual([0, 0, 255]);
  });
});

describe("art failures", () => {
  beforeEach(() => {
    warn.mockClear();
  });

  function ioReading(readFile: () => Promise<Buffer>): Io {
    return { ...defaultIo, fs: { ...defaultIo.fs, readFile: readFile as never } };
  }

  it("keeps a missing art file silent", async () => {
    const missing = Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });
    const io = ioReading(() => Promise.reject(missing));

    expect(await tileArtDataUri(io, "img-1", 72, 102, 1, artFailureLog("deck"))).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs the first other failure of one image once", async () => {
    const io = ioReading(() => Promise.resolve(Buffer.from("not an image")));
    const failures = artFailureLog("deck");

    expect(await tileArtDataUri(io, "img-1", 72, 102, 1, failures)).toBeNull();
    expect(await tileArtDataUri(io, "img-2", 72, 102, 1, failures)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      { err: expect.any(Error), image: "deck", subject: "img-1" },
      "share image art failed",
    );
  });
});

describe("elideTitle", () => {
  it("leaves a title within the cap untouched", () => {
    expect(elideTitle("Azir UNL - Current", 34)).toBe("Azir UNL - Current");
  });

  it("elides an overlong title to the cap with a single ellipsis", () => {
    const result = elideTitle("A".repeat(40), 34);
    expect(result).toHaveLength(34);
    expect(result.endsWith("…")).toBe(true);
  });

  it("trims trailing space before the ellipsis", () => {
    expect(elideTitle(`${"word ".repeat(8)}tail`, 34)).not.toContain(" …");
  });
});
