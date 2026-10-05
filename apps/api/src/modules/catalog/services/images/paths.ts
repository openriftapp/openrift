// oxlint-disable-next-line import/no-nodejs-modules -- server-side file needs filesystem access
import { join } from "node:path";

import { MEDIA_DIR } from "../../../../lib/media-upload.js";

export function imageRehostedUrl(imageId: string): string {
  return `/media/cards/${imageId.slice(-2)}/${imageId}`;
}

export const CARD_MEDIA_DIR = join(MEDIA_DIR, "cards");
