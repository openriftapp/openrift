import { join } from "node:path";

import { isRegenerateImagesCheckpoint } from "@openrift/shared/contracts/admin/job-results";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import { imageRehostedUrl } from "@openrift/shared/image-url";
import type { Logger } from "@openrift/shared/logger";
import { errorMessage } from "@openrift/shared/strings";
import type {
  RegenerateImagesCheckpoint,
  RehostImageResponse,
  RefetchImagesResponse,
} from "@openrift/shared/types/api/admin";

import { AppError } from "../../../../errors.js";
import type { Io } from "../../../../io.js";
import { assertFound } from "../../../../lib/assertions.js";
import type { jobRunsRepo } from "../../../system/repositories/job-runs.js";
import type { printingImagesRepo } from "../../repositories/printing-images.js";
import { fetchOriginalImage } from "./original-source.js";
import { CARD_MEDIA_DIR } from "./paths.js";
import { rehostFailureReason } from "./rehost-error.js";
import {
  deleteRehostFiles,
  generateWebpVariants,
  origFileOnDisk,
  processAndSave,
} from "./variants.js";

type PrintingImagesRepo = ReturnType<typeof printingImagesRepo>;
type JobRunsRepo = ReturnType<typeof jobRunsRepo>;

export const REGENERATE_IMAGES_KIND = "images.regenerate";

export interface RehostOutcome {
  status: "rehosted" | "already-rehosted" | "skipped" | "failed";
  error?: string;
}

export async function rehostImageFile(
  io: Io,
  repo: PrintingImagesRepo,
  imageFileId: string,
  options: { overwrite?: boolean } = {},
): Promise<RehostOutcome> {
  const file = await repo.getImageFileForRehost(imageFileId);
  if (!file) {
    return { status: "skipped" };
  }
  if (file.rehostedUrl !== null && !options.overwrite) {
    await repo.promoteRehosted(file.id);
    return { status: "already-rehosted" };
  }
  if (!file.originalUrl) {
    return { status: "skipped" };
  }

  const rehostedUrl = imageRehostedUrl(file.id);
  let mayHaveWritten = false;
  try {
    const { buffer, ext } = await fetchOriginalImage(io, file.originalUrl);
    mayHaveWritten = true;
    await processAndSave(
      io,
      buffer,
      ext,
      join(CARD_MEDIA_DIR, file.id.slice(-2)),
      file.id,
      file.rotation,
      file.needsTrim,
      file.quad,
      true,
    );
    if (!(await repo.completeRehost(file.id, rehostedUrl))) {
      await deleteRehostFiles(io, rehostedUrl);
      return { status: "skipped" };
    }
    return { status: "rehosted" };
  } catch (error) {
    console.error(`[rehost] Rehost failed for image file ${imageFileId}:`, errorMessage(error));
    const message = rehostFailureReason(error);
    if (mayHaveWritten && file.rehostedUrl === null) {
      await deleteRehostFiles(io, rehostedUrl);
    }
    await repo.recordRehostFailure(file.id, message);
    return { status: "failed", error: message };
  }
}

async function settleRehosts(
  io: Io,
  repo: PrintingImagesRepo,
  imageFileIds: readonly string[],
  options: { overwrite?: boolean } = {},
): Promise<RehostOutcome[]> {
  const settled = await Promise.allSettled(
    imageFileIds.map((imageFileId) => rehostImageFile(io, repo, imageFileId, options)),
  );
  return settled.map((result) =>
    result.status === "fulfilled"
      ? result.value
      : { status: "failed", error: errorMessage(result.reason) },
  );
}

export async function rehostImageFileOrThrow(
  io: Io,
  repo: PrintingImagesRepo,
  imageFileId: string,
  options: { overwrite?: boolean } = {},
): Promise<void> {
  const outcome = await rehostImageFile(io, repo, imageFileId, options);
  if (outcome.status === "failed") {
    throw new AppError(
      400,
      ERROR_CODES.BAD_REQUEST,
      `Could not rehost the image: ${outcome.error ?? "unknown error"}`,
    );
  }
  if (outcome.status === "skipped") {
    throw new AppError(400, ERROR_CODES.BAD_REQUEST, "Image has no original URL to rehost");
  }
}

export async function rehostFaceImage(
  io: Io,
  repo: PrintingImagesRepo,
  imageId: string,
): Promise<RehostOutcome> {
  try {
    const imageFileId = await repo.getImageFileId(imageId);
    return imageFileId === undefined
      ? { status: "skipped" }
      : await rehostImageFile(io, repo, imageFileId);
  } catch (error) {
    const message = errorMessage(error);
    console.error(`[rehost] Rehost failed for image ${imageId}:`, message);
    return { status: "failed", error: message };
  }
}

export async function ensureRehostedOriginal(
  io: Io,
  repo: PrintingImagesRepo,
  file: { imageFileId: string; rehostedUrl: string | null },
): Promise<void> {
  if (file.rehostedUrl !== null && (await origFileOnDisk(io, file.imageFileId)) !== undefined) {
    return;
  }
  await rehostImageFileOrThrow(io, repo, file.imageFileId, {
    overwrite: file.rehostedUrl !== null,
  });
}

export function rehostImagesInBackground(
  io: Io,
  repo: PrintingImagesRepo,
  imageIds: readonly string[],
): void {
  for (const imageId of imageIds) {
    void rehostFaceImage(io, repo, imageId);
  }
}

/**
 * Batch size for image-rehost and image-regenerate loops. Trades off four
 * things: (1) Sharp encode parallelism per batch (memory pressure scales
 * roughly linearly), (2) cancel-request latency (cancel is checked between
 * batches), (3) job-run checkpoint write frequency, and (4) work lost to a
 * crash mid-batch. 10 sits in the middle on all four.
 */
const BATCH_SIZE = 10;

export async function rehostImages(
  io: Io,
  repo: PrintingImagesRepo,
  limit = BATCH_SIZE,
): Promise<RehostImageResponse> {
  const images = await repo.listUnrehosted(limit);
  const outcomes = await settleRehosts(
    io,
    repo,
    images.map((img) => img.imageId),
  );

  const progress: RehostImageResponse = {
    total: images.length,
    rehosted: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
  for (const [idx, img] of images.entries()) {
    const outcome = outcomes[idx];
    if (outcome?.status === "failed") {
      progress.failed++;
      progress.errors.push(`${img.imageId}: ${outcome.error ?? "unknown error"}`);
    } else if (outcome?.status === "rehosted" || outcome?.status === "already-rehosted") {
      progress.rehosted++;
    } else {
      progress.skipped++;
    }
  }
  return progress;
}

export const REHOST_RETRY_KIND = "images.rehost_retry";

const REHOST_RETRY_LIMIT = 20;

export interface RehostRetryResult {
  attempted: number;
  rehosted: number;
  promoted: number;
  skipped: number;
  failed: number;
}

export function isRehostRetryNoop(result: RehostRetryResult): boolean {
  return result.attempted === 0;
}

export async function retryDueRehosts(
  io: Io,
  repo: PrintingImagesRepo,
  limit = REHOST_RETRY_LIMIT,
): Promise<RehostRetryResult> {
  const imageFileIds = await repo.listDueRehosts(limit);
  const result: RehostRetryResult = {
    attempted: imageFileIds.length,
    rehosted: 0,
    promoted: 0,
    skipped: 0,
    failed: 0,
  };
  for (let start = 0; start < imageFileIds.length; start += BATCH_SIZE) {
    const outcomes = await settleRehosts(io, repo, imageFileIds.slice(start, start + BATCH_SIZE));
    for (const outcome of outcomes) {
      if (outcome.status === "rehosted") {
        result.rehosted++;
      } else if (outcome.status === "already-rehosted") {
        result.promoted++;
      } else if (outcome.status === "skipped") {
        result.skipped++;
      } else {
        result.failed++;
      }
    }
  }
  return result;
}

/** Cap on the number of error strings retained in a checkpoint, to keep the
 * `job_runs.result` JSONB row from growing unbounded on bad runs. */
const MAX_CHECKPOINT_ERRORS = 100;

interface RegenerateBatchResult {
  regenerated: number;
  failed: number;
  errors: string[];
}

async function refetchMissingOriginal(
  io: Io,
  repo: PrintingImagesRepo,
  imageFileId: string,
): Promise<void> {
  const outcome = await rehostImageFile(io, repo, imageFileId, { overwrite: true });
  if (outcome.status === "skipped") {
    throw new Error("no -orig file on disk and no originalUrl to re-fetch (uploaded image)");
  }
  if (outcome.status === "failed") {
    throw new Error(`no -orig file on disk; re-fetch failed: ${outcome.error ?? "unknown error"}`);
  }
}

export async function regenerateImagesBatch(
  io: Io,
  repo: PrintingImagesRepo,
  batch: { imageId: string; rehostedUrl: string }[],
  options: { skipExisting?: boolean } = {},
): Promise<RegenerateBatchResult> {
  const out: RegenerateBatchResult = { regenerated: 0, failed: 0, errors: [] };
  if (batch.length === 0) {
    return out;
  }

  const settings = await repo.getVariantSettingsByIds(batch.map((img) => img.imageId));

  const results = await Promise.allSettled(
    batch.map(async (img) => {
      const prefixDir = join(CARD_MEDIA_DIR, img.imageId.slice(-2));
      const origFile = await origFileOnDisk(io, img.imageId);
      if (origFile === undefined) {
        await refetchMissingOriginal(io, repo, img.imageId);
        return;
      }
      const buffer = await io.fs.readFile(join(prefixDir, origFile));
      const setting = settings.get(img.imageId);
      await generateWebpVariants(
        io,
        buffer,
        prefixDir,
        img.imageId,
        setting?.rotation ?? 0,
        setting?.needsTrim ?? false,
        setting?.quad ?? null,
        options.skipExisting,
      );
      await repo.clearRehostFailure(img.imageId);
    }),
  );

  for (const [idx, { imageId }] of batch.entries()) {
    const result = results[idx];
    if (!result) {
      continue;
    }
    if (result.status === "fulfilled") {
      out.regenerated++;
    } else {
      out.failed++;
      const message = errorMessage(result.reason);
      out.errors.push(`${imageId}: ${message}`);
      console.error(`[regenerate] ${imageId}:`, message);
    }
  }

  return out;
}

function appendCappedErrors(existing: string[], more: string[]): string[] {
  if (more.length === 0) {
    return existing;
  }
  const combined = [...existing, ...more];
  if (combined.length <= MAX_CHECKPOINT_ERRORS) {
    return combined;
  }
  return combined.slice(combined.length - MAX_CHECKPOINT_ERRORS);
}

interface RunRegenerateJobDeps {
  io: Io;
  printingImages: PrintingImagesRepo;
  jobRuns: JobRunsRepo;
  log: Logger;
}

interface RunRegenerateJobOptions {
  resumeFrom?: { runId: string; checkpoint: RegenerateImagesCheckpoint };
  skipExisting?: boolean;
  scansOnly?: boolean;
}

/**
 * Run the resumable regenerate-images job for a single `job_runs` row, writing
 * a fresh checkpoint to the row's `result` JSONB after every batch. Between
 * batches it re-reads the row to honor `cancelRequested`, so a parallel cancel
 * endpoint can stop the loop without killing the process. Errors thrown by the
 * per-batch helper itself (vs per-image failures, which it records into
 * `errors`) bubble up so `runJobAsync` records the run as `failed`; the
 * returned final checkpoint becomes the succeeded run's `result`.
 */
export async function runRegenerateImagesJob(
  deps: RunRegenerateJobDeps,
  runId: string,
  options: RunRegenerateJobOptions = {},
): Promise<RegenerateImagesCheckpoint> {
  const { io, printingImages, jobRuns, log } = deps;
  const skipExisting = options.skipExisting ?? false;

  let checkpoint: RegenerateImagesCheckpoint;
  if (options.resumeFrom) {
    const { runId: priorRunId, checkpoint: prior } = options.resumeFrom;
    log.info(
      {
        runId,
        priorRunId,
        lastProcessedIndex: prior.lastProcessedIndex,
        totalFiles: prior.totalFiles,
      },
      "Resuming regenerate-images from prior checkpoint",
    );
    checkpoint = {
      ...prior,
      resumedFromRunId: priorRunId,
      cancelRequested: false,
      skipExisting,
    };
  } else {
    const snapshot = await printingImages.listAllRehosted(options.scansOnly ?? false);
    checkpoint = {
      snapshot,
      totalFiles: snapshot.length,
      lastProcessedIndex: -1,
      processed: 0,
      regenerated: 0,
      failed: 0,
      errors: [],
      resumedFromRunId: null,
      cancelRequested: false,
      skipExisting,
    };
    log.info({ runId, totalFiles: snapshot.length }, "Starting fresh regenerate-images");
  }

  await jobRuns.updateResult(runId, checkpoint);

  let cursor = checkpoint.lastProcessedIndex + 1;
  while (cursor < checkpoint.totalFiles) {
    const batch = checkpoint.snapshot.slice(cursor, cursor + BATCH_SIZE);
    const batchResult = await regenerateImagesBatch(io, printingImages, batch, { skipExisting });

    cursor += batch.length;
    checkpoint = {
      ...checkpoint,
      lastProcessedIndex: cursor - 1,
      processed: checkpoint.processed + batch.length,
      regenerated: checkpoint.regenerated + batchResult.regenerated,
      failed: checkpoint.failed + batchResult.failed,
      errors: appendCappedErrors(checkpoint.errors, batchResult.errors),
    };

    // mergeResult keeps a stored `cancelRequested` over this patch's `false`,
    // so a cancel landing around this write survives it; the re-read after the
    // write is what makes it visible to the loop.
    await jobRuns.mergeResult(runId, checkpoint);
    const latestResult = await jobRuns.getResult(runId);
    const cancelRequested =
      isRegenerateImagesCheckpoint(latestResult) && latestResult.cancelRequested === true;

    if (cancelRequested) {
      log.warn({ runId, cursor }, "regenerate-images cancelled mid-run");
      throw new Error("cancelled");
    }
  }

  return checkpoint;
}

export async function unrehostImageFile(
  io: Io,
  repo: PrintingImagesRepo,
  imageFileId: string,
): Promise<string> {
  const image = await repo.getImageFileById(imageFileId);
  assertFound(image, "Image file not found");
  if (!image.rehostedUrl) {
    throw new AppError(400, ERROR_CODES.BAD_REQUEST, "Image is not rehosted");
  }
  if (await repo.isActiveImageFile(imageFileId)) {
    throw new AppError(409, ERROR_CODES.CONFLICT, "Deactivate the image first");
  }
  if (await repo.isPinnedFallbackFile(imageFileId)) {
    throw new AppError(409, ERROR_CODES.CONFLICT, "Unpin the fallback art first");
  }
  // image_files requires original_url or rehosted_url, and an upload has no
  // original to fall back to.
  if (!image.originalUrl) {
    throw new AppError(
      400,
      ERROR_CODES.BAD_REQUEST,
      "Cannot un-rehost: image has no original URL to fall back to",
    );
  }
  await repo.clearPendingForFile(imageFileId);
  await repo.clearRehostFailure(imageFileId);
  await deleteRehostFiles(io, image.rehostedUrl);
  await repo.updateRehostedUrl(imageFileId, null);
  return image.rehostedUrl;
}

export async function refetchImages(
  io: Io,
  repo: PrintingImagesRepo,
  imageFileIds: string[],
): Promise<RefetchImagesResponse> {
  const progress: RefetchImagesResponse = {
    total: imageFileIds.length,
    refetched: 0,
    failed: 0,
    errors: [],
  };

  for (let start = 0; start < imageFileIds.length; start += BATCH_SIZE) {
    const batch = imageFileIds.slice(start, start + BATCH_SIZE);
    const outcomes = await settleRehosts(io, repo, batch, { overwrite: true });
    for (const [idx, imageFileId] of batch.entries()) {
      const outcome = outcomes[idx];
      if (outcome?.status === "rehosted") {
        progress.refetched++;
        continue;
      }
      progress.failed++;
      const reason =
        outcome?.status === "failed"
          ? (outcome.error ?? "unknown error")
          : "no original URL to re-fetch (uploaded image)";
      progress.errors.push(`${imageFileId}: ${reason}`);
    }
  }

  return progress;
}
