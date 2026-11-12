import { isRegenerateImagesCheckpoint } from "@openrift/shared/contracts/admin/job-results";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeMockRepo,
  mockFetch,
  mockIo,
  mockReadFile,
  mockReaddir,
  mockSharpInstance,
  mockUnlink,
  mockWriteFile,
  resetImageMocks,
} from "../../../../test/image-mocks.js";
import {
  ensureRehostedOriginal,
  regenerateImagesBatch,
  rehostFaceImage,
  rehostImageFile,
  rehostImageFileOrThrow,
  rehostImages,
  isRehostRetryNoop,
  refetchImages,
  retryDueRehosts,
  runRegenerateImagesJob,
  unrehostImageFile,
} from "./jobs.js";

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetImageMocks();
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe("rehostImages", () => {
  it("returns zeros when no images found", async () => {
    const result = await rehostImages(mockIo, makeMockRepo());
    expect(result).toEqual({ total: 0, rehosted: 0, skipped: 0, failed: 0, errors: [] });
  });

  it("rehosts an image", async () => {
    const repo = makeMockRepo({
      selectResult: [
        {
          imageId: "img-001",
          originalUrl: "https://example.com/img.png",
        },
      ],
    });

    const result = await rehostImages(mockIo, repo);
    expect(result).toEqual({ total: 1, rehosted: 1, skipped: 0, failed: 0, errors: [] });
    expect(mockFetch).toHaveBeenCalledWith("https://example.com/img.png", {
      headers: { Referer: "https://example.com/" },
      signal: expect.any(AbortSignal),
      redirect: "manual",
    });
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it("skips null originalUrl", async () => {
    const repo = makeMockRepo({
      selectResult: [{ imageId: "img-1", originalUrl: null }],
    });
    const result = await rehostImages(mockIo, repo);
    expect(result.skipped).toBe(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("counts download failures", async () => {
    mockFetch.mockRejectedValue(new TypeError("fetch failed"));
    const repo = makeMockRepo({
      selectResult: [{ imageId: "img-1", originalUrl: "https://x.com/img" }],
    });
    const result = await rehostImages(mockIo, repo);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain("connection failed");
  });

  it("handles non-Error thrown values", async () => {
    mockFetch.mockRejectedValue("string-error");
    const repo = makeMockRepo({
      selectResult: [{ imageId: "img-1", originalUrl: "https://x.com/img" }],
    });
    const result = await rehostImages(mockIo, repo);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain("could not process the image");
  });

  it("processes a mixed batch of success, skip, and failure", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(Buffer.from("ok"), { headers: { "content-type": "image/png" } }),
      )
      .mockRejectedValueOnce(new Error("timeout"));

    const repo = makeMockRepo({
      selectResult: [
        {
          imageId: "img-1",
          originalUrl: "https://example.com/ok.png",
        },
        { imageId: "img-2", originalUrl: null },
        {
          imageId: "img-3",
          originalUrl: "https://example.com/fail.png",
        },
      ],
    });

    const result = await rehostImages(mockIo, repo);
    expect(result.total).toBe(3);
    expect(result.rehosted).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("timeout");
  });

  it("respects a custom limit parameter", async () => {
    const repo = makeMockRepo({
      selectResult: [
        {
          imageId: "img-1",
          originalUrl: "https://example.com/img.png",
        },
      ],
    });
    const result = await rehostImages(mockIo, repo, 5);
    expect(result.rehosted).toBe(1);
  });
});

describe("rehostImageFile", () => {
  const FILE_ID = "00594247-a18a-4efd-8998-105449a4cf40";

  function makeRehostRepo(
    file: {
      originalUrl: string | null;
      rehostedUrl?: string | null;
      rotation?: number;
      needsTrim?: boolean;
    } | null,
  ) {
    return {
      getImageFileId: vi.fn(async () => (file === null ? undefined : FILE_ID)),
      getImageFileForRehost: vi.fn(async () =>
        file === null
          ? undefined
          : {
              id: FILE_ID,
              originalUrl: file.originalUrl,
              rehostedUrl: file.rehostedUrl ?? null,
              rotation: file.rotation ?? 0,
              needsTrim: file.needsTrim ?? false,
              quad: null,
            },
      ),
      completeRehost: vi.fn(async () => true),
      promoteRehosted: vi.fn(async () => {}),
      recordRehostFailure: vi.fn(async () => {}),
    } as any;
  }

  it("skips a file with no original URL", async () => {
    const repo = makeRehostRepo({ originalUrl: null });

    expect(await rehostImageFile(mockIo, repo, FILE_ID)).toEqual({ status: "skipped" });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(repo.completeRehost).not.toHaveBeenCalled();
  });

  it("skips a file that is gone", async () => {
    const repo = makeRehostRepo(null);

    expect(await rehostImageFile(mockIo, repo, FILE_ID)).toEqual({ status: "skipped" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("downloads, processes, then completes the rehost in one step", async () => {
    const repo = makeRehostRepo({ originalUrl: "https://example.com/img.png" });

    expect(await rehostImageFile(mockIo, repo, FILE_ID)).toEqual({ status: "rehosted" });
    expect(mockFetch).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
    expect(repo.completeRehost).toHaveBeenCalledWith(FILE_ID, `/media/cards/40/${FILE_ID}`);
    expect(repo.recordRehostFailure).not.toHaveBeenCalled();
  });

  it("propagates needsTrim from the image_file row to the scan analysis", async () => {
    const repo = makeRehostRepo({ originalUrl: "https://example.com/img.png", needsTrim: true });

    await rehostImageFile(mockIo, repo, FILE_ID);

    expect(mockSharpInstance.greyscale).toHaveBeenCalled();
  });

  it("records a failed download for the retry job and activates nothing", async () => {
    mockFetch.mockRejectedValue(new Error("timeout"));
    const repo = makeRehostRepo({ originalUrl: "https://example.com/img.png" });

    const outcome = await rehostImageFile(mockIo, repo, FILE_ID);

    expect(outcome.status).toBe("failed");
    expect(outcome.error).toContain("timeout");
    expect(repo.recordRehostFailure).toHaveBeenCalledWith(
      FILE_ID,
      expect.stringContaining("timeout"),
    );
    expect(repo.completeRehost).not.toHaveBeenCalled();
  });

  it("only promotes pending images when the file is already rehosted", async () => {
    const repo = makeRehostRepo({
      originalUrl: "https://example.com/img.png",
      rehostedUrl: `/media/cards/40/${FILE_ID}`,
    });

    expect(await rehostImageFile(mockIo, repo, FILE_ID)).toEqual({ status: "already-rehosted" });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(repo.promoteRehosted).toHaveBeenCalledWith(FILE_ID);
    expect(repo.completeRehost).not.toHaveBeenCalled();
  });

  it("re-downloads an already rehosted file on overwrite", async () => {
    const repo = makeRehostRepo({
      originalUrl: "https://example.com/img.png",
      rehostedUrl: `/media/cards/40/${FILE_ID}`,
    });

    expect(await rehostImageFile(mockIo, repo, FILE_ID, { overwrite: true })).toEqual({
      status: "rehosted",
    });
    expect(mockFetch).toHaveBeenCalled();
  });

  it("deletes the files it wrote when recording the rehost fails, so nothing unflagged stays public", async () => {
    const repo = makeRehostRepo({ originalUrl: "https://example.com/img.png" });
    repo.completeRehost.mockRejectedValue(new Error("connection reset"));
    mockReaddir.mockResolvedValue([`${FILE_ID}-orig.png`, `${FILE_ID}-full.webp`]);

    const outcome = await rehostImageFile(mockIo, repo, FILE_ID);

    expect(outcome).toEqual({ status: "failed", error: "could not process the image" });
    expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining(`${FILE_ID}-full.webp`));
    expect(repo.recordRehostFailure).toHaveBeenCalledWith(FILE_ID, "could not process the image");
  });

  it("deletes the files it wrote when the image file was deleted meanwhile", async () => {
    const repo = makeRehostRepo({ originalUrl: "https://example.com/img.png" });
    repo.completeRehost.mockResolvedValue(false);
    mockReaddir.mockResolvedValue([`${FILE_ID}-orig.png`, `${FILE_ID}-full.webp`]);

    const outcome = await rehostImageFile(mockIo, repo, FILE_ID);

    expect(outcome).toEqual({ status: "skipped" });
    expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining(`${FILE_ID}-full.webp`));
    expect(repo.recordRehostFailure).not.toHaveBeenCalled();
  });

  it("keeps the files of an already rehosted file when an overwrite fails", async () => {
    const repo = makeRehostRepo({
      originalUrl: "https://example.com/img.png",
      rehostedUrl: `/media/cards/40/${FILE_ID}`,
    });
    repo.completeRehost.mockRejectedValue(new Error("connection reset"));

    await rehostImageFile(mockIo, repo, FILE_ID, { overwrite: true });

    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it("throws the failure as a readable error for admin actions", async () => {
    mockFetch.mockRejectedValue(new Error("timeout"));
    const repo = makeRehostRepo({ originalUrl: "https://example.com/img.png" });

    await expect(rehostImageFileOrThrow(mockIo, repo, FILE_ID)).rejects.toThrow(
      /Could not rehost the image: .*timeout/u,
    );
  });

  it("refuses an admin rehost of a file with no original", async () => {
    const repo = makeRehostRepo({ originalUrl: null });

    await expect(rehostImageFileOrThrow(mockIo, repo, FILE_ID)).rejects.toThrow(
      "Image has no original URL to rehost",
    );
  });

  it("resolves a face image to its file", async () => {
    const repo = makeRehostRepo({ originalUrl: "https://example.com/img.png" });

    expect(await rehostFaceImage(mockIo, repo, "img-1")).toEqual({ status: "rehosted" });
    expect(repo.completeRehost).toHaveBeenCalledWith(FILE_ID, `/media/cards/40/${FILE_ID}`);
  });
});

describe("ensureRehostedOriginal", () => {
  const FILE_ID = "00594247-a18a-4efd-8998-105449a4cf40";

  function makeRepo(file: { originalUrl: string | null; rehostedUrl: string | null }) {
    return {
      getImageFileForRehost: vi.fn(async () => ({
        id: FILE_ID,
        ...file,
        rotation: 0,
        needsTrim: false,
        quad: null,
      })),
      completeRehost: vi.fn(async () => true),
      recordRehostFailure: vi.fn(async () => {}),
    } as any;
  }

  it("leaves a rehosted file with its local original alone", async () => {
    mockReaddir.mockResolvedValue([`${FILE_ID}-orig.png`]);
    const repo = makeRepo({
      originalUrl: "https://example.com/img.png",
      rehostedUrl: `/media/cards/40/${FILE_ID}`,
    });

    await ensureRehostedOriginal(mockIo, repo, {
      imageFileId: FILE_ID,
      rehostedUrl: `/media/cards/40/${FILE_ID}`,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rehosts a file that is not rehosted yet, so its working copy is a real rehost", async () => {
    const repo = makeRepo({ originalUrl: "https://example.com/img.png", rehostedUrl: null });

    await ensureRehostedOriginal(mockIo, repo, { imageFileId: FILE_ID, rehostedUrl: null });

    expect(mockFetch).toHaveBeenCalled();
    expect(repo.completeRehost).toHaveBeenCalledWith(FILE_ID, `/media/cards/40/${FILE_ID}`);
  });
});

describe("unrehostImageFile", () => {
  function makeUnrehostRepo(
    file: { originalUrl: string | null; rehostedUrl: string | null } | undefined,
    active = false,
    pinned = false,
  ) {
    return {
      updateRehostedUrl: vi.fn(() => Promise.resolve()),
      isActiveImageFile: vi.fn(() => Promise.resolve(active)),
      isPinnedFallbackFile: vi.fn(() => Promise.resolve(pinned)),
      clearPendingForFile: vi.fn(() => Promise.resolve()),
      clearRehostFailure: vi.fn(() => Promise.resolve()),
      getImageFileById: vi.fn((id: string) =>
        Promise.resolve(file === undefined ? undefined : { id, ...file }),
      ),
    } as any;
  }

  it("clears rehostedUrl and deletes the files of an inactive image", async () => {
    const repo = makeUnrehostRepo({
      originalUrl: "https://example.com/x.png",
      rehostedUrl: "/media/cards/01/file-1",
    });
    mockReaddir.mockResolvedValue(["file-1-orig.png", "file-1-400w.webp"]);

    expect(await unrehostImageFile(mockIo, repo, "file-1")).toBe("/media/cards/01/file-1");
    expect(repo.updateRehostedUrl).toHaveBeenCalledWith("file-1", null);
    expect(repo.clearPendingForFile).toHaveBeenCalledWith("file-1");
    expect(repo.clearRehostFailure).toHaveBeenCalledWith("file-1");
    expect(mockUnlink).toHaveBeenCalledTimes(2);
  });

  it("refuses pinned fallback art, which the public sees", async () => {
    const repo = makeUnrehostRepo(
      { originalUrl: "https://example.com/x.png", rehostedUrl: "/media/cards/01/file-1" },
      false,
      true,
    );

    await expect(unrehostImageFile(mockIo, repo, "file-1")).rejects.toMatchObject({
      status: 409,
      message: "Unpin the fallback art first",
    });
    expect(repo.updateRehostedUrl).not.toHaveBeenCalled();
  });

  it("refuses an image that is live on a face", async () => {
    const repo = makeUnrehostRepo(
      { originalUrl: "https://example.com/x.png", rehostedUrl: "/media/cards/01/file-1" },
      true,
    );

    await expect(unrehostImageFile(mockIo, repo, "file-1")).rejects.toMatchObject({
      status: 409,
      message: "Deactivate the image first",
    });
    expect(repo.updateRehostedUrl).not.toHaveBeenCalled();
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it("refuses an image that is not rehosted", async () => {
    const repo = makeUnrehostRepo({ originalUrl: "https://example.com/x.png", rehostedUrl: null });

    await expect(unrehostImageFile(mockIo, repo, "file-1")).rejects.toThrow("not rehosted");
  });

  it("refuses an upload, which has no original to fall back to", async () => {
    const repo = makeUnrehostRepo({ originalUrl: null, rehostedUrl: "/media/cards/ed/file-1" });

    await expect(unrehostImageFile(mockIo, repo, "file-1")).rejects.toThrow("no original URL");
    expect(mockUnlink).not.toHaveBeenCalled();
  });
});

describe("retryDueRehosts", () => {
  function makeRetryRepo(due: Record<string, string>) {
    return {
      listDueRehosts: vi.fn(() => Promise.resolve(Object.keys(due))),
      getImageFileForRehost: vi.fn((id: string) =>
        Promise.resolve({
          id,
          originalUrl: due[id],
          rehostedUrl: null,
          rotation: 0,
          needsTrim: false,
          quad: null,
        }),
      ),
      completeRehost: vi.fn(() => Promise.resolve(true)),
      promoteRehosted: vi.fn(() => Promise.resolve()),
      recordRehostFailure: vi.fn(() => Promise.resolve()),
    } as any;
  }

  it("is a no-op when nothing is due", async () => {
    const result = await retryDueRehosts(mockIo, makeRetryRepo({}));

    expect(result).toEqual({ attempted: 0, rehosted: 0, promoted: 0, skipped: 0, failed: 0 });
    expect(isRehostRetryNoop(result)).toBe(true);
  });

  it("rehosts each due file, activating it, and counts the failures it records", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(Buffer.from("ok"), { headers: { "content-type": "image/png" } }),
      )
      .mockRejectedValueOnce(new Error("timeout"));
    const repo = makeRetryRepo({
      "file-01": "https://example.com/a.png",
      "file-02": "https://example.com/b.png",
    });

    const result = await retryDueRehosts(mockIo, repo, 5);

    expect(repo.listDueRehosts).toHaveBeenCalledWith(5);
    expect(result).toEqual({ attempted: 2, rehosted: 1, promoted: 0, skipped: 0, failed: 1 });
    expect(repo.completeRehost).toHaveBeenCalledTimes(1);
    expect(repo.recordRehostFailure).toHaveBeenCalledTimes(1);
    expect(isRehostRetryNoop(result)).toBe(false);
  });

  it("isolates a database error to its own file", async () => {
    const repo = makeRetryRepo({
      "file-01": "https://example.com/a.png",
      "file-02": "https://example.com/b.png",
    });
    repo.getImageFileForRehost.mockRejectedValueOnce(new Error("connection reset"));

    const result = await retryDueRehosts(mockIo, repo);

    expect(result).toMatchObject({ attempted: 2, rehosted: 1, failed: 1 });
  });
});

describe("refetchImages", () => {
  function makeRefetchRepo(files: Record<string, string | null>) {
    return {
      getImageFileForRehost: vi.fn((id: string) =>
        Promise.resolve(
          id in files
            ? {
                id,
                originalUrl: files[id],
                rehostedUrl: `/media/cards/${id.slice(-2)}/${id}`,
                rotation: 0,
                needsTrim: false,
                quad: null,
              }
            : undefined,
        ),
      ),
      completeRehost: vi.fn(() => Promise.resolve(true)),
      recordRehostFailure: vi.fn(() => Promise.resolve()),
      updateRehostedUrl: vi.fn(() => Promise.resolve()),
    } as any;
  }

  it("returns zeros when called with an empty list", async () => {
    expect(await refetchImages(mockIo, makeRefetchRepo({}), [])).toEqual({
      total: 0,
      refetched: 0,
      failed: 0,
      errors: [],
    });
  });

  it("downloads each original again and keeps the file rehosted", async () => {
    const repo = makeRefetchRepo({ "file-01": "https://example.com/x.png" });

    const result = await refetchImages(mockIo, repo, ["file-01"]);

    expect(result).toEqual({ total: 1, refetched: 1, failed: 0, errors: [] });
    expect(mockFetch).toHaveBeenCalled();
    expect(repo.completeRehost).toHaveBeenCalledWith("file-01", "/media/cards/01/file-01");
    expect(repo.updateRehostedUrl).not.toHaveBeenCalled();
  });

  it("reports uploads, unknown files and failed downloads per item", async () => {
    mockFetch.mockRejectedValue(new Error("timeout"));
    const repo = makeRefetchRepo({
      "file-up": null,
      "file-dl": "https://example.com/x.png",
    });

    const result = await refetchImages(mockIo, repo, ["file-up", "file-dl", "file-gone"]);

    expect(result.refetched).toBe(0);
    expect(result.failed).toBe(3);
    expect(result.errors[0]).toContain("uploaded image");
    expect(result.errors[1]).toContain("timeout");
    expect(result.errors[2]).toContain("file-gone");
  });
});

// Build a {imageId, rehostedUrl} entry shaped like `listAllRehosted` rows for
// the per-batch helper.
function snap(imageId: string, rehostedUrl?: string) {
  return { imageId, rehostedUrl: rehostedUrl ?? `/media/cards/${imageId.slice(-2)}/${imageId}` };
}

describe("regenerateImagesBatch", () => {
  it("returns empty totals on an empty batch (no repo or fs reads)", async () => {
    const repo = makeMockRepo({});
    const result = await regenerateImagesBatch(mockIo, repo, []);
    expect(result).toEqual({ regenerated: 0, failed: 0, errors: [] });
    expect(repo.getVariantSettingsByIds).not.toHaveBeenCalled();
  });

  it("regenerates variants from on-disk orig files for each entry", async () => {
    const repo = makeMockRepo({});
    mockReaddir.mockImplementation(async () => ["card-001-orig.png", "card-002-orig.jpg"]);
    const result = await regenerateImagesBatch(mockIo, repo, [snap("card-001"), snap("card-002")]);
    expect(result.regenerated).toBe(2);
    expect(mockReadFile).toHaveBeenCalledTimes(2);
    expect(repo.clearRehostFailure).toHaveBeenCalledWith("card-001");
  });

  it("re-fetches a missing prefix dir in place and keeps the file rehosted", async () => {
    const repo = makeMockRepo({
      imageFile: {
        id: "card-001",
        originalUrl: "https://example.com/card.png",
        rehostedUrl: "/media/cards/01/card-001",
      },
    });
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    const result = await regenerateImagesBatch(mockIo, repo, [
      snap("card-001", "/media/cards/01/card-001"),
    ]);
    expect(result).toEqual({ regenerated: 1, failed: 0, errors: [] });
    expect(mockFetch).toHaveBeenCalled();
    expect(repo.completeRehost).toHaveBeenCalledWith("card-001", "/media/cards/01/card-001");
    expect(repo.updateRehostedUrl).not.toHaveBeenCalled();
  });

  it("re-fetches a missing -orig in place and keeps the file rehosted", async () => {
    const repo = makeMockRepo({
      imageFile: {
        id: "card-001",
        originalUrl: "https://example.com/card.png",
        rehostedUrl: "/media/cards/01/card-001",
      },
    });
    mockReaddir.mockImplementation(async () => ["card-001-400w.webp", "card-001-full.webp"]);
    const result = await regenerateImagesBatch(mockIo, repo, [
      snap("card-001", "/media/cards/01/card-001"),
    ]);
    expect(result.regenerated).toBe(1);
    expect(repo.updateRehostedUrl).not.toHaveBeenCalled();
  });

  it("reports a failed re-fetch without un-rehosting the file", async () => {
    const repo = makeMockRepo({
      imageFile: {
        id: "card-001",
        originalUrl: "https://example.com/card.png",
        rehostedUrl: "/media/cards/01/card-001",
      },
    });
    mockReaddir.mockImplementation(async () => ["card-001-400w.webp"]);
    mockFetch.mockRejectedValue(new Error("timeout"));
    const result = await regenerateImagesBatch(mockIo, repo, [snap("card-001")]);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain("re-fetch failed");
    expect(repo.updateRehostedUrl).not.toHaveBeenCalled();
  });

  it("reports an uploaded image (no originalUrl) whose -orig is missing", async () => {
    const repo = makeMockRepo({
      imageFile: { id: "card-001", originalUrl: null, rehostedUrl: "/some/url" },
    });
    mockReaddir.mockImplementation(async () => ["card-001-400w.webp"]);
    const result = await regenerateImagesBatch(mockIo, repo, [snap("card-001")]);
    expect(result.failed).toBe(1);
    expect(result.regenerated).toBe(0);
    expect(result.errors[0]).toContain("uploaded image");
    expect(repo.updateRehostedUrl).not.toHaveBeenCalled();
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it("counts readFile failures", async () => {
    const repo = makeMockRepo({});
    mockReaddir.mockImplementation(async () => ["card-001-orig.png"]);
    mockReadFile.mockRejectedValue(new Error("read error"));
    const result = await regenerateImagesBatch(mockIo, repo, [snap("card-001")]);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain("read error");
  });

  it("handles non-Error thrown values", async () => {
    const repo = makeMockRepo({});
    mockReaddir.mockImplementation(async () => ["card-001-orig.png"]);
    mockReadFile.mockRejectedValue("raw-string-error");
    const result = await regenerateImagesBatch(mockIo, repo, [snap("card-001")]);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain("raw-string-error");
  });

  it("with skipExisting only writes the variants missing from disk", async () => {
    const repo = makeMockRepo({});
    // 240w + full on disk, 120w + 400w missing — write only the two gaps.
    mockReaddir.mockImplementation(async () => [
      "card-001-orig.png",
      "card-001-240w.webp",
      "card-001-full.webp",
    ]);
    const result = await regenerateImagesBatch(mockIo, repo, [snap("card-001")], {
      skipExisting: true,
    });
    expect(result.regenerated).toBe(1);
    expect(mockWriteFile).toHaveBeenCalledTimes(2);
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining("card-001-120w.webp"),
      expect.any(Buffer),
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining("card-001-400w.webp"),
      expect.any(Buffer),
    );
  });

  it("with skipExisting skips entirely when every variant exists", async () => {
    const repo = makeMockRepo({});
    mockReaddir.mockImplementation(async () => [
      "card-001-orig.png",
      "card-001-120w.webp",
      "card-001-240w.webp",
      "card-001-400w.webp",
      "card-001-full.webp",
    ]);
    const result = await regenerateImagesBatch(mockIo, repo, [snap("card-001")], {
      skipExisting: true,
    });
    expect(result.regenerated).toBe(1);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("uses per-image needsTrim from the settings map", async () => {
    const repo = makeMockRepo({});
    repo.getVariantSettingsByIds = vi.fn(() =>
      Promise.resolve(new Map([["card-trim", { rotation: 0, needsTrim: true }]])),
    );
    mockReaddir.mockImplementation(async () => ["card-trim-orig.png"]);
    await regenerateImagesBatch(mockIo, repo, [snap("card-trim")]);

    expect(mockSharpInstance.greyscale).toHaveBeenCalled();
  });

  it("skips the scan analysis when needsTrim is false in the settings map", async () => {
    const repo = makeMockRepo({});
    repo.getVariantSettingsByIds = vi.fn(() =>
      Promise.resolve(new Map([["card-keep", { rotation: 0, needsTrim: false }]])),
    );
    mockReaddir.mockImplementation(async () => ["card-keep-orig.png"]);
    await regenerateImagesBatch(mockIo, repo, [snap("card-keep")]);

    expect(mockSharpInstance.greyscale).not.toHaveBeenCalled();
  });

  it("defaults to needsTrim=false when the settings map lacks an entry", async () => {
    // A row missing from the rotations/needsTrim map (e.g. raced delete) must
    // not retroactively start trimming; defaulting to false matches the
    // digital-image-default invariant.
    const repo = makeMockRepo({});
    repo.getVariantSettingsByIds = vi.fn(() => Promise.resolve(new Map()));
    mockReaddir.mockImplementation(async () => ["card-orphan-orig.png"]);
    await regenerateImagesBatch(mockIo, repo, [snap("card-orphan")]);

    expect(mockSharpInstance.greyscale).not.toHaveBeenCalled();
  });
});

// Minimal in-memory job_runs repo good enough for runRegenerateImagesJob:
// tracks the current `result` JSONB. Tests can mutate the stored value
// directly via `setCancel` to simulate the cancel endpoint racing with the
// job loop.
function makeFakeJobRunsRepo(initial: unknown = null) {
  const state: { stored: unknown } = { stored: initial };
  const repo = {
    updateResult: vi.fn(async (_id: string, result: unknown) => {
      state.stored = result;
    }),
    mergeResult: vi.fn(async (_id: string, patch: object) => {
      const prior = (state.stored ?? {}) as Record<string, unknown>;
      const preserved = prior.cancelRequested === true;
      state.stored = { ...prior, ...(patch as Record<string, unknown>) };
      if (preserved) {
        (state.stored as Record<string, unknown>).cancelRequested = true;
      }
    }),
    getResult: vi.fn(async () => state.stored),
    start: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
    getRunning: vi.fn(),
    listRecent: vi.fn(),
    getLatestPerKind: vi.fn(),
    sweepOrphaned: vi.fn(),
    purgeOlderThan: vi.fn(),
    getLatestForResume: vi.fn(),
  };
  const current = () => state.stored;
  const setCancel = () => {
    if (state.stored && typeof state.stored === "object") {
      state.stored = { ...(state.stored as Record<string, unknown>), cancelRequested: true };
    }
  };
  return { repo: repo as any, current, setCancel };
}

const noopLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(() => noopLog),
} as any;

describe("runRegenerateImagesJob", () => {
  it("snapshots from listAllRehosted on a fresh start and processes everything", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => snap(`card-${String(i).padStart(3, "0")}`));
    const printingImages = makeMockRepo({ rehosted: ids });
    mockReaddir.mockImplementation(async () => ids.map((s) => `${s.imageId}-orig.png`));
    const fake = makeFakeJobRunsRepo();

    const result = await runRegenerateImagesJob(
      { io: mockIo, printingImages, jobRuns: fake.repo, log: noopLog },
      "run-1",
    );

    expect(result.totalFiles).toBe(12);
    expect(result.lastProcessedIndex).toBe(11);
    expect(result.processed).toBe(12);
    expect(result.regenerated).toBe(12);
    expect(result.failed).toBe(0);
    expect(result.resumedFromRunId).toBeNull();
    // The initial snapshot write; per-batch progress goes through mergeResult.
    expect(fake.repo.updateResult).toHaveBeenCalledTimes(1);
    // 12 / batch_size 10 = 2 batches.
    expect(fake.repo.mergeResult).toHaveBeenCalledTimes(2);
    // Default: whole catalog, not just scans.
    expect(printingImages.listAllRehosted).toHaveBeenCalledWith(false);
  });

  it("snapshots only scans when scansOnly is set", async () => {
    const ids = [snap("scan-001")];
    const printingImages = makeMockRepo({ rehosted: ids });
    mockReaddir.mockImplementation(async () => ids.map((s) => `${s.imageId}-orig.png`));
    const fake = makeFakeJobRunsRepo();

    const result = await runRegenerateImagesJob(
      { io: mockIo, printingImages, jobRuns: fake.repo, log: noopLog },
      "run-scans",
      { scansOnly: true },
    );

    expect(printingImages.listAllRehosted).toHaveBeenCalledWith(true);
    expect(result.totalFiles).toBe(1);
  });

  it("resumes from a prior checkpoint and skips already-processed entries", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => snap(`card-${String(i).padStart(3, "0")}`));
    const printingImages = makeMockRepo({ rehosted: [] });
    // Disk reads succeed for everything we DO process.
    mockReaddir.mockImplementation(async () => ids.map((s) => `${s.imageId}-orig.png`));
    const fake = makeFakeJobRunsRepo();

    const priorCheckpoint = {
      snapshot: ids,
      totalFiles: 12,
      lastProcessedIndex: 4,
      processed: 5,
      regenerated: 5,
      failed: 0,
      errors: [],
      resumedFromRunId: null,
      cancelRequested: false,
      skipExisting: false,
    };

    const result = await runRegenerateImagesJob(
      { io: mockIo, printingImages, jobRuns: fake.repo, log: noopLog },
      "run-2",
      { resumeFrom: { runId: "run-1", checkpoint: priorCheckpoint } },
    );

    expect(printingImages.listAllRehosted).not.toHaveBeenCalled();
    expect(result.lastProcessedIndex).toBe(11);
    expect(result.processed).toBe(12);
    // 5 already counted from prior + 7 from this run = 12.
    expect(result.regenerated).toBe(12);
    expect(result.resumedFromRunId).toBe("run-1");
    // Per-batch helper sees only the 7 unprocessed entries (settings fetched once).
    const settingsCallArgs = (printingImages.getVariantSettingsByIds as any).mock.calls[0][0];
    expect(settingsCallArgs).toHaveLength(7);
    expect(settingsCallArgs[0]).toBe("card-005");
  });

  it("stops mid-run and throws 'cancelled' when cancelRequested flips between batches", async () => {
    const ids = Array.from({ length: 25 }, (_, i) => snap(`card-${String(i).padStart(3, "0")}`));
    const printingImages = makeMockRepo({ rehosted: ids });
    mockReaddir.mockImplementation(async () => ids.map((s) => `${s.imageId}-orig.png`));
    const fake = makeFakeJobRunsRepo();

    // The cancel-check happens after each batch's processing but before the
    // batch's progress is written. To stop after exactly one batch, trip the
    // cancel flag right after the initial snapshot write — by the time the
    // loop's first cancel-check runs, the row already has cancelRequested=true.
    let writes = 0;
    const realUpdate = fake.repo.updateResult.getMockImplementation()!;
    fake.repo.updateResult.mockImplementation(async (id: string, value: unknown) => {
      await realUpdate(id, value);
      writes++;
      if (writes === 1) {
        fake.setCancel();
      }
    });

    await expect(
      runRegenerateImagesJob(
        { io: mockIo, printingImages, jobRuns: fake.repo, log: noopLog },
        "run-cancel",
      ),
    ).rejects.toThrow("cancelled");

    const final = fake.current() as { processed: number; cancelRequested: boolean };
    // First batch (10) ran; cancel checked after; second batch did not start.
    expect(final.processed).toBe(10);
    expect(final.cancelRequested).toBe(true);
  });

  it("keeps a cancel that lands while a batch's progress write is in flight", async () => {
    const ids = Array.from({ length: 25 }, (_, i) => snap(`card-${String(i).padStart(3, "0")}`));
    const printingImages = makeMockRepo({ rehosted: ids });
    mockReaddir.mockImplementation(async () => ids.map((s) => `${s.imageId}-orig.png`));
    const fake = makeFakeJobRunsRepo();

    // The cancel endpoint writes the flag just as the loop merges its first
    // batch's progress (which carries cancelRequested: false). The merge must
    // not drop the flag, so the loop stops before batch two.
    const realMerge = fake.repo.mergeResult.getMockImplementation()!;
    let merges = 0;
    fake.repo.mergeResult.mockImplementation(async (id: string, patch: object) => {
      merges++;
      if (merges === 1) {
        fake.setCancel();
      }
      await realMerge(id, patch);
    });

    await expect(
      runRegenerateImagesJob(
        { io: mockIo, printingImages, jobRuns: fake.repo, log: noopLog },
        "run-cancel-race",
      ),
    ).rejects.toThrow("cancelled");

    const final = fake.current() as { processed: number; cancelRequested: boolean };
    expect(final.processed).toBe(10);
    expect(final.cancelRequested).toBe(true);
  });

  it("isRegenerateImagesCheckpoint accepts the canonical shape and rejects partial values", () => {
    const ok = {
      snapshot: [],
      totalFiles: 0,
      lastProcessedIndex: -1,
      processed: 0,
      regenerated: 0,
      failed: 0,
      errors: [],
      resumedFromRunId: null,
      cancelRequested: false,
      skipExisting: false,
    };
    expect(isRegenerateImagesCheckpoint(ok)).toBe(true);
    expect(isRegenerateImagesCheckpoint(null)).toBe(false);
    expect(isRegenerateImagesCheckpoint({})).toBe(false);
    expect(isRegenerateImagesCheckpoint({ ...ok, snapshot: "not-an-array" })).toBe(false);
    expect(isRegenerateImagesCheckpoint({ ...ok, cancelRequested: "no" })).toBe(false);
  });
});
