import { describe, expect, it, vi } from "vitest";

import type { Io } from "../../../../io.js";
import { isFingerprintSweepNoop, sweepImageFingerprints } from "./fingerprint-sweep.js";

vi.mock("./download.js", () => ({
  downloadImage: vi.fn(async (_io: Io, url: string) => {
    if (url.includes("broken")) {
      throw new Error("404");
    }
    return { buffer: Buffer.from(url), ext: "png" };
  }),
}));

vi.mock("./fingerprint.js", () => ({
  computeImageFingerprint: vi.fn(async (_io: Io, buffer: Buffer) => `fp:${buffer.toString()}`),
  computeCandidateFingerprint: vi.fn(
    async (_io: Io, buffer: Buffer, live: string | null) => `fp:${buffer.toString()}:${live}`,
  ),
}));

const warn = vi.fn();
const log = { warn } as never;

function makeDeps(liveFiles: { id: string; rehostedUrl: string }[], candidates: unknown[]) {
  const io = {
    fs: {
      readFile: vi.fn(async (path: string) => {
        if (path.includes("missing")) {
          throw new Error("ENOENT");
        }
        return Buffer.from(path);
      }),
    },
  } as unknown as Io;
  const repos = {
    printingImages: {
      listRehostedWithoutFingerprint: vi.fn().mockResolvedValue(liveFiles),
      setFingerprint: vi.fn().mockResolvedValue(undefined),
    },
    candidateCards: {
      listPrintingsNeedingFingerprint: vi.fn().mockResolvedValue(candidates),
      setImageFingerprint: vi.fn().mockResolvedValue(undefined),
    },
  };
  return { io, repos };
}

describe("sweepImageFingerprints", () => {
  it("fingerprints rehosted live files from their full-size variant", async () => {
    const { io, repos } = makeDeps([{ id: "abcd12", rehostedUrl: "/media/cards/12/abcd12" }], []);
    const result = await sweepImageFingerprints(io, repos as never, log);
    expect(repos.printingImages.setFingerprint).toHaveBeenCalledWith(
      "abcd12",
      expect.stringMatching(/^fp:.*\/12\/abcd12-full\.webp$/u),
    );
    expect(result).toEqual({
      liveFingerprinted: 1,
      liveFailed: 0,
      candidatesFingerprinted: 0,
      candidatesFailed: 0,
    });
  });

  it("counts a live file that cannot be read as failed and keeps going", async () => {
    const { io, repos } = makeDeps(
      [
        { id: "missing1", rehostedUrl: "/media/cards/g1/missing1" },
        { id: "ok2", rehostedUrl: "/media/cards/k2/ok2" },
      ],
      [],
    );
    const result = await sweepImageFingerprints(io, repos as never, log);
    expect(repos.printingImages.setFingerprint).toHaveBeenCalledTimes(1);
    expect(result.liveFailed).toBe(1);
    expect(result.liveFingerprinted).toBe(1);
  });

  it("downloads candidate images, compares against the live fingerprint and records the URL", async () => {
    const { io, repos } = makeDeps(
      [],
      [{ id: "cp1", imageUrl: "https://src.example/a.png", liveFingerprint: "live-fp" }],
    );
    const result = await sweepImageFingerprints(io, repos as never, log);
    expect(repos.candidateCards.setImageFingerprint).toHaveBeenCalledWith(
      "cp1",
      "https://src.example/a.png",
      "fp:https://src.example/a.png:live-fp",
    );
    expect(result.candidatesFingerprinted).toBe(1);
  });

  it("records a failed download with no fingerprint so it is not retried", async () => {
    const { io, repos } = makeDeps(
      [],
      [{ id: "cp2", imageUrl: "https://src.example/broken.png", liveFingerprint: null }],
    );
    const result = await sweepImageFingerprints(io, repos as never, log);
    expect(repos.candidateCards.setImageFingerprint).toHaveBeenCalledWith(
      "cp2",
      "https://src.example/broken.png",
      null,
    );
    expect(result.candidatesFailed).toBe(1);
    expect(warn).toHaveBeenCalled();
  });

  it("passes the batch limits to both listings", async () => {
    const { io, repos } = makeDeps([], []);
    await sweepImageFingerprints(io, repos as never, log, { live: 7, candidates: 3 });
    expect(repos.printingImages.listRehostedWithoutFingerprint).toHaveBeenCalledWith(7);
    expect(repos.candidateCards.listPrintingsNeedingFingerprint).toHaveBeenCalledWith(3);
  });
});

describe("isFingerprintSweepNoop", () => {
  it("is true only when nothing was touched", () => {
    expect(
      isFingerprintSweepNoop({
        liveFingerprinted: 0,
        liveFailed: 0,
        candidatesFingerprinted: 0,
        candidatesFailed: 0,
      }),
    ).toBe(true);
    expect(
      isFingerprintSweepNoop({
        liveFingerprinted: 0,
        liveFailed: 1,
        candidatesFingerprinted: 0,
        candidatesFailed: 0,
      }),
    ).toBe(false);
  });
});
