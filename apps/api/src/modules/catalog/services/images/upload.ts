import { join } from "node:path";

import { ERROR_CODES } from "@openrift/shared/error-codes";
import { imageRehostedUrl } from "@openrift/shared/image-url";
import { v7 as uuidv7 } from "uuid";

import { AppError } from "../../../../errors.js";
import type { Io } from "../../../../io.js";
import { MAX_IMAGE_BYTES } from "./download.js";
import { CARD_MEDIA_DIR } from "./paths.js";
import { processAndSave } from "./variants.js";

export async function saveUploadedImage(
  io: Io,
  file: File,
): Promise<{ imageFileId: string; rehostedUrl: string }> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new AppError(413, ERROR_CODES.PAYLOAD_TOO_LARGE, "File exceeds 50 MB limit");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name ? `.${file.name.split(".").pop()?.toLowerCase() ?? "png"}` : ".png";
  const imageFileId = uuidv7();
  const outputDir = join(CARD_MEDIA_DIR, imageFileId.slice(-2));
  await processAndSave(io, buffer, ext, outputDir, imageFileId, 0, false, null);
  return { imageFileId, rehostedUrl: imageRehostedUrl(imageFileId) };
}
