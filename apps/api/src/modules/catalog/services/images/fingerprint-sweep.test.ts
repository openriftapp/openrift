import { describe, expect, it, vi } from "vitest";

import type { Io } from "../../../../io.js";
import type * as DownloadModule from "./download.js";
import { isFingerprintSweepNoop, sweepImageFingerprints } from "./fingerprint-sweep.js";

vi.mock("./download.js", async (importOriginal) => {
  const actual = await importOriginal<typeof DownloadModule>();
  return {
    ...actual,
    downloadImage: vi.fn(async (_io: Io, url: string) => {
      if (!url.startsWith("https://")) {
        throw new TypeError("Invalid URL");
      }
      if (url.includes("broken")) {
        throw new actual.DownloadError({ kind: "http", status: 404 }, `404: ${url}`);
      }
      if (url.includes("flaky")) {
        throw new actual.DownloadError({ kind: "timeout" }, `Download timed out: ${url}`);
      }
      if (url.includes("down")) {
        throw new actual.DownloadError({ kind: "http", status: 503 }, `503: ${url}`);
      }
      return { buffer: Buffer.from(url), ext: "png" };
    }),
  };
});

vi.mock("./fingerprint.js", () => ({
  computeImageFingerprint: vi.fn(async (_io: Io, buffer: Buffer) => `fp:${buffer.toString()}`),
  computeCandidateFingerprint: vi.fn(
    async (_io: Io, buffer: Buffer, live: string | null) => `fp:${buffer.toString()}:${live}`,
  ),
}));

const warn = vi.fn();
const log = { warn } as never;

function makeDeps(
  liveFiles: { id: string; rehostedUrl: string }[],
  candidates: unknown[],
  failureAttempts = 1,
) {
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
      recordFingerprintFailure: vi.fn().mockResolvedValue(failureAttempts),
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

  it("reads a contributor photo upload from disk", async () => {
    const url = "/media/submissions/01a18225-4ee0-729c-bd9b-6452e5f3eb91.jpg";
    const { io, repos } = makeDeps([], [{ id: "cp3", imageUrl: url, liveFingerprint: null }]);
    const result = await sweepImageFingerprints(io, repos as never, log);
    expect(repos.candidateCards.setImageFingerprint).toHaveBeenCalledWith(
      "cp3",
      url,
      expect.stringMatching(
        /^fp:.*\/media\/submissions\/01a18225-4ee0-729c-bd9b-6452e5f3eb91\.jpg:null$/u,
      ),
    );
    expect(result.candidatesFingerprinted).toBe(1);
  });

  it("records a permanent failure with no fingerprint so it is not retried", async () => {
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
    expect(repos.candidateCards.recordFingerprintFailure).not.toHaveBeenCalled();
    expect(result.candidatesFailed).toBe(1);
    expect(warn).toHaveBeenCalled();
  });

  it.each([
    ["a timeout", "https://src.example/flaky.png", "timeout"],
    ["a 5xx answer", "https://src.example/down.png", "HTTP 503"],
  ])("leaves %s open for a retry", async (_label, imageUrl, reason) => {
    const { io, repos } = makeDeps([], [{ id: "cp4", imageUrl, liveFingerprint: null }]);
    const result = await sweepImageFingerprints(io, repos as never, log);
    expect(repos.candidateCards.recordFingerprintFailure).toHaveBeenCalledWith(
      "cp4",
      imageUrl,
      reason,
    );
    expect(repos.candidateCards.setImageFingerprint).not.toHaveBeenCalled();
    expect(result.candidatesFailed).toBe(1);
  });

  it("gives up on a transient failure after the last allowed attempt", async () => {
    const { io, repos } = makeDeps(
      [],
      [{ id: "cp5", imageUrl: "https://src.example/flaky.png", liveFingerprint: null }],
      6,
    );
    await sweepImageFingerprints(io, repos as never, log);
    expect(repos.candidateCards.setImageFingerprint).toHaveBeenCalledWith(
      "cp5",
      "https://src.example/flaky.png",
      null,
    );
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
