// oxlint-disable-next-line import/no-nodejs-modules -- server-side file needs filesystem path join
import { extname, join } from "node:path";

import { isSubmissionUploadUrl } from "@openrift/shared/contribute-schema";

import type { Repos } from "../../../deps.js";
import type { Io } from "../../../io.js";
import type { MediaUploadResult } from "../../../lib/media-upload.js";
import { createMediaUploadStore } from "../../../lib/media-upload.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const MAX_EDGE_PX = 4000;

const SWEEP_GRACE_DAYS = 7;

const JPEG_QUALITY = 92;

export type SubmissionUploadResult = MediaUploadResult;

interface SaveSubmissionUploadArgs {
  userId: string;
  buffer: Buffer;
  now: Date;
}

async function reencode(io: Io, buffer: Buffer): Promise<{ data: Buffer; ext: string } | null> {
  try {
    const { format } = await io.sharp(buffer).metadata();
    if (!format) {
      return null;
    }
    // Re-encoding is what drops EXIF, GPS included: sharp writes no metadata
    // unless asked to.
    const pipeline = io
      .sharp(buffer)
      .rotate()
      .resize(MAX_EDGE_PX, MAX_EDGE_PX, { fit: "inside", withoutEnlargement: true });
    return format === "png"
      ? { data: await pipeline.png().toBuffer(), ext: "png" }
      : { data: await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer(), ext: "jpg" };
  } catch {
    return null;
  }
}

const store = createMediaUploadStore({
  subdir: "submissions",
  dailyLimit: 200,
  encode: reencode,
});

export const SUBMISSION_MEDIA_DIR = store.dir;

export function saveSubmissionUpload(
  io: Io,
  args: SaveSubmissionUploadArgs,
): Promise<SubmissionUploadResult> {
  return store.save(io, args);
}

export async function readSubmissionUpload(
  io: Io,
  url: string,
): Promise<{ buffer: Buffer; ext: string }> {
  if (!isSubmissionUploadUrl(url)) {
    throw new Error(`Not a submission upload URL: ${url}`);
  }
  const name = store.fileName(url);
  const buffer = await io.fs.readFile(join(SUBMISSION_MEDIA_DIR, name));
  return { buffer, ext: extname(name) };
}

export async function deleteSubmissionUpload(io: Io, url: string): Promise<void> {
  if (!isSubmissionUploadUrl(url)) {
    return;
  }
  await store.remove(io, url);
}

// An upload an admin already attached stays: `image_files.original_url` still points at it.
export async function discardSubmissionUploads(
  io: Io,
  repos: Repos,
  candidateCardId: string,
): Promise<void> {
  try {
    const imageUrls = await repos.cardSubmissions.candidatePrintingImageUrls(candidateCardId);
    const urls = imageUrls.filter((url) => isSubmissionUploadUrl(url));
    if (urls.length === 0) {
      return;
    }
    const inUse = await repos.printingImages.originalUrlsInUse(urls);
    for (const url of urls) {
      if (!inUse.has(url)) {
        await deleteSubmissionUpload(io, url);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[submission-uploads] Cleanup failed for candidate ${candidateCardId}:`, message);
  }
}

export interface SubmissionUploadSweepResult {
  scanned: number;
  deleted: number;
  cutoff: string;
}

async function olderThan(io: Io, name: string, cutoffMs: number): Promise<boolean> {
  try {
    const stats = await io.fs.stat(join(SUBMISSION_MEDIA_DIR, name));
    return stats.mtimeMs < cutoffMs;
  } catch {
    return false;
  }
}

export async function sweepSubmissionUploads(
  io: Io,
  repos: Repos,
  args: { now: Date },
): Promise<SubmissionUploadSweepResult> {
  const cutoff = new Date(args.now.getTime() - SWEEP_GRACE_DAYS * DAY_MS);

  let names: string[];
  try {
    names = await io.fs.readdir(SUBMISSION_MEDIA_DIR);
  } catch {
    return { scanned: 0, deleted: 0, cutoff: cutoff.toISOString() };
  }

  const urls = names
    .map((name) => `${store.urlPrefix}${name}`)
    .filter((url) => isSubmissionUploadUrl(url));

  const stale: string[] = [];
  for (const url of urls) {
    if (await olderThan(io, store.fileName(url), cutoff.getTime())) {
      stale.push(url);
    }
  }

  if (stale.length === 0) {
    return { scanned: urls.length, deleted: 0, cutoff: cutoff.toISOString() };
  }

  const [candidateUrls, imageFileUrls] = await Promise.all([
    repos.cardSubmissions.candidateImageUrlsInUse(stale),
    repos.printingImages.originalUrlsInUse(stale),
  ]);

  let deleted = 0;
  for (const url of stale) {
    if (candidateUrls.has(url) || imageFileUrls.has(url)) {
      continue;
    }
    await deleteSubmissionUpload(io, url);
    deleted += 1;
  }

  return { scanned: urls.length, deleted, cutoff: cutoff.toISOString() };
}
