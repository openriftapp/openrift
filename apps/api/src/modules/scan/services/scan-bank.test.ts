import type { Logger } from "@openrift/shared/logger";
import { decodeEmbedBank } from "@openrift/shared/scan/embed-format";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Io } from "../../../io.js";
import type { ScanReferenceRow } from "../../catalog/repositories/catalog-printings.js";
import { rebuildScanBank, scanArtKey } from "./scan-bank.js";

const embedding = vi.hoisted(() => ({ dim: 4, axisOf: (row: number) => row }));

vi.mock("onnxruntime-node", () => ({
  InferenceSession: {
    create: async () => ({
      inputMetadata: [{ isTensor: true, shape: [1, 3, 8, 8] }],
      run: async (feeds: { pixel_values: { dims: number[] } }) => {
        const count = feeds.pixel_values.dims[0] ?? 0;
        const data = new Float32Array(count * embedding.dim);
        for (let row = 0; row < count; row++) {
          data[row * embedding.dim + (embedding.axisOf(row) % embedding.dim)] = 1;
        }
        return { image_embeds: { data } };
      },
      release: async () => {},
    }),
  },
  Tensor: class {
    dims: number[];
    constructor(_type: string, _data: Float32Array, dims: number[]) {
      this.dims = dims;
    }
  },
}));

const base = { setSlug: "origins", name: "Jinx", artVariant: "normal", isOvernumbered: false };

describe("scanArtKey", () => {
  it("keys an overnumbered print apart from the in-total print of the same card", () => {
    expect(scanArtKey(base)).not.toBe(scanArtKey({ ...base, isOvernumbered: true }));
  });

  it("keys an overnumbered alt art apart from both the plain alt art and the plain print", () => {
    const keys = [
      scanArtKey(base),
      scanArtKey({ ...base, artVariant: "altart" }),
      scanArtKey({ ...base, artVariant: "altart", isOvernumbered: true }),
    ];
    expect(new Set(keys).size).toBe(3);
  });

  it("collapses a null art variant onto the empty segment", () => {
    expect(scanArtKey({ ...base, artVariant: null })).toBe("origins|Jinx||");
  });

  it("matches the scan script's four-segment key layout", () => {
    expect(scanArtKey({ ...base, isOvernumbered: true }).split("|")).toEqual([
      "origins",
      "Jinx",
      "normal",
      "over",
    ]);
  });
});

function texture(seed: number, width = 80, height = 112): Buffer {
  const data = Buffer.alloc(width * height * 4);
  let state = seed;
  for (let pixel = 0; pixel < width * height; pixel++) {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    const value = state % 256;
    data.set([value, value, value, 255], pixel * 4);
  }
  return data;
}

function reference(imageId: string, setSlug: string, name: string): ScanReferenceRow {
  return {
    imageId,
    name,
    setSlug,
    publicCode: `${setSlug}-001`,
    language: "EN",
    cardType: "unit",
    artVariant: "normal",
    isOvernumbered: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    markersMin: "",
    markersMax: "",
  };
}

async function rebuildArtKeys(
  rows: { row: ScanReferenceRow; texture: Buffer }[],
): Promise<Record<string, string>> {
  const textures = new Map(rows.map(({ row, texture: bytes }) => [row.imageId, bytes]));
  const written = new Map<string, Buffer>();
  const io = {
    fs: {
      stat: vi.fn(async () => ({})),
      readFile: vi.fn(async (file: string) => Buffer.from(file)),
      mkdir: vi.fn(async () => {}),
      writeFile: vi.fn(async (file: string, data: Buffer) => {
        written.set(file, data);
      }),
      readdir: vi.fn(async () => []),
      unlink: vi.fn(async () => {}),
    },
    sharp: (input: Buffer) => {
      const file = input.toString();
      const id = [...textures.keys()].find((key) => file.includes(key)) ?? "";
      const chain = {
        flatten: () => chain,
        raw: () => chain,
        toColourspace: () => chain,
        ensureAlpha: () => chain,
        toBuffer: async () => ({ data: textures.get(id), info: { width: 80, height: 112 } }),
      };
      return chain;
    },
  } as unknown as Io;
  const repos = {
    catalog: { scanReferences: async () => rows.map(({ row }) => row) },
    scanIndex: { get: async () => null, put: vi.fn(async () => {}) },
  };
  const log = { info: vi.fn(), warn: vi.fn() } as unknown as Logger;

  await rebuildScanBank({
    repos: repos as unknown as Parameters<typeof rebuildScanBank>[0]["repos"],
    io,
    log,
    encoderFile: "encoder.onnx",
  });

  const bankFile = [...written].find(([file]) => file.endsWith(".bin"))?.[1];
  expect(bankFile).toBeDefined();
  const bytes = new Uint8Array(bankFile as Buffer);
  const { artKeys } = decodeEmbedBank(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  return Object.fromEntries(artKeys);
}

describe("rebuildScanBank", () => {
  afterEach(() => {
    embedding.dim = 4;
    embedding.axisOf = (row) => row;
  });

  it("a rebuild writes each key's illustration group root as its artKey", async () => {
    expect(
      await rebuildArtKeys([
        { row: reference("img-jinx-origins", "origins", "Jinx"), texture: texture(1) },
        { row: reference("img-jinx-reprint", "spiritforged", "Jinx"), texture: texture(1) },
        { row: reference("img-vi", "origins", "Vi"), texture: texture(2) },
      ]),
    ).toEqual({
      "img-jinx-origins": "origins|Jinx|normal|",
      "img-jinx-reprint": "origins|Jinx|normal|",
      "img-vi": "origins|Vi|normal|",
    });
  });

  it("a rebuild with the 256-d encoder merges one card's renders whose embeddings coincide", async () => {
    embedding.dim = 256;
    embedding.axisOf = (row) => (row === 2 ? 1 : 0);
    expect(
      await rebuildArtKeys([
        { row: reference("img-jinx-origins", "origins", "Jinx"), texture: texture(1) },
        { row: reference("img-jinx-reprint", "spiritforged", "Jinx"), texture: texture(3) },
        { row: reference("img-jinx-proving", "proving", "Jinx"), texture: texture(5) },
      ]),
    ).toEqual({
      "img-jinx-origins": "origins|Jinx|normal|",
      "img-jinx-reprint": "origins|Jinx|normal|",
      "img-jinx-proving": "proving|Jinx|normal|",
    });
  });

  it("a rebuild with another encoder keeps coinciding renders of different illustrations apart", async () => {
    embedding.axisOf = () => 0;
    expect(
      await rebuildArtKeys([
        { row: reference("img-jinx-origins", "origins", "Jinx"), texture: texture(1) },
        { row: reference("img-jinx-reprint", "spiritforged", "Jinx"), texture: texture(3) },
      ]),
    ).toEqual({
      "img-jinx-origins": "origins|Jinx|normal|",
      "img-jinx-reprint": "spiritforged|Jinx|normal|",
    });
  });

  it("a rebuild never merges coinciding renders of different cards", async () => {
    embedding.dim = 256;
    embedding.axisOf = () => 0;
    expect(
      await rebuildArtKeys([
        { row: reference("img-jinx", "origins", "Jinx"), texture: texture(1) },
        { row: reference("img-vi", "origins", "Vi"), texture: texture(3) },
      ]),
    ).toEqual({
      "img-jinx": "origins|Jinx|normal|",
      "img-vi": "origins|Vi|normal|",
    });
  });
});
