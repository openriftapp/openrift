import { join } from "node:path";

import type { ImageQuad } from "@openrift/shared/contracts/admin/card-images";
import { imageRehostedUrl } from "@openrift/shared/image-url";
import { v7 as uuidv7 } from "uuid";

import { badRequest, conflict } from "../../../../errors.js";
import type { Io } from "../../../../io.js";
import type { printingImagesRepo } from "../../repositories/printing-images.js";
import { fetchOriginalImage } from "./original-source.js";
import { CARD_MEDIA_DIR } from "./paths.js";
import { rehostFailureReason } from "./rehost-error.js";
import { deleteRehostFiles, origFileOnDisk, processAndSave } from "./variants.js";

type PrintingImagesRepo = ReturnType<typeof printingImagesRepo>;

export interface ImageFileSettings {
  rotation: 0 | 90 | 180 | 270;
  needsTrim: boolean;
  quad: ImageQuad | null;
}

function sameQuad(a: ImageQuad | null, b: ImageQuad | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return a.every((point, index) => point.x === b[index]?.x && point.y === b[index]?.y);
}

function sameSettings(a: ImageFileSettings, b: ImageFileSettings): boolean {
  return a.rotation === b.rotation && a.needsTrim === b.needsTrim && sameQuad(a.quad, b.quad);
}

async function readSource(
  io: Io,
  imageFileId: string,
  originalUrl: string | null,
): Promise<{ buffer: Buffer; ext: string }> {
  const origFile = await origFileOnDisk(io, imageFileId);
  if (origFile !== undefined) {
    const buffer = await io.fs.readFile(join(CARD_MEDIA_DIR, imageFileId.slice(-2), origFile));
    return { buffer, ext: origFile.slice(`${imageFileId}-orig`.length) };
  }
  if (originalUrl === null) {
    throw badRequest("Image has no rehosted original");
  }
  try {
    return await fetchOriginalImage(io, originalUrl);
  } catch (error) {
    throw badRequest(`Could not rehost the image: ${rehostFailureReason(error)}`);
  }
}

/**
 * Writes the variants under a new image file id and moves every user of `oldId`
 * onto it. Undefined when the old row is gone or nothing used it.
 */
export async function writeReplacementFile(
  io: Io,
  repo: PrintingImagesRepo,
  oldId: string,
  source: { buffer: Buffer; ext: string },
  settings: ImageFileSettings,
): Promise<string | undefined> {
  const id = uuidv7();
  const rehostedUrl = imageRehostedUrl(id);
  let replaced: boolean;
  try {
    await processAndSave(
      io,
      source.buffer,
      source.ext,
      join(CARD_MEDIA_DIR, id.slice(-2)),
      id,
      settings.rotation,
      settings.needsTrim,
      settings.quad,
    );
    replaced = await repo.replaceImageFile(oldId, {
      id,
      rehostedUrl,
      rotation: settings.rotation,
      needsTrim: settings.needsTrim,
      quad: settings.quad,
    });
  } catch (error) {
    await deleteRehostFiles(io, rehostedUrl);
    throw error;
  }
  if (!replaced) {
    await deleteRehostFiles(io, rehostedUrl);
    return undefined;
  }
  return id;
}

/**
 * Rehosted URLs are cached as immutable, so an edit writes its variants under a
 * new image file id and moves every user of the old row onto it. The old files
 * stay on disk for browsers holding an older catalogue until the orphan sweep
 * removes them. Returns the id that now holds the image.
 */
export async function editImageFile(
  io: Io,
  repo: PrintingImagesRepo,
  current: ImageFileSettings & { imageFileId: string; originalUrl: string | null },
  next: ImageFileSettings,
): Promise<string> {
  if (sameSettings(current, next)) {
    return current.imageFileId;
  }

  const source = await readSource(io, current.imageFileId, current.originalUrl);
  const id = await writeReplacementFile(io, repo, current.imageFileId, source, next);
  if (id === undefined) {
    throw conflict("The image changed while it was being edited. Reload and try again.");
  }
  return id;
}
