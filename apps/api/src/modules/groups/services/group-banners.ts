// oxlint-disable-next-line import/no-nodejs-modules -- server-side file needs filesystem path join
import { join } from "node:path";

import { GROUP_BANNER_WIDTH, isGroupBannerUrl } from "@openrift/shared/group-banner";
import { v7 as uuidv7 } from "uuid";

import type { Io } from "../../../io.js";
import { MEDIA_DIR } from "../../catalog/services/images/paths.js";

export const GROUP_BANNER_MEDIA_DIR = join(MEDIA_DIR, "group-banners");

const URL_PREFIX = "/media/group-banners/";

const UPLOAD_DAILY_LIMIT = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

const WEBP_QUALITY = 82;

const uploadTimesByUser = new Map<string, number[]>();

export type GroupBannerUploadResult =
  | { status: "ok"; url: string }
  | { status: "not_an_image" }
  | { status: "rate_limited"; limit: number };

interface SaveGroupBannerArgs {
  userId: string;
  buffer: Buffer;
  now: Date;
}

async function reencode(io: Io, buffer: Buffer): Promise<Buffer | null> {
  try {
    const { format } = await io.sharp(buffer).metadata();
    if (!format) {
      return null;
    }
    // Re-encoding is what drops EXIF, GPS included: sharp writes no metadata
    // unless asked to.
    return await io
      .sharp(buffer)
      .rotate()
      .resize(GROUP_BANNER_WIDTH, undefined, { withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch {
    return null;
  }
}

// nginx serves `media/group-banners/` to anyone; the uuid filename is the only
// thing keeping a banner unlisted while the group page itself is members-only.
export async function saveGroupBanner(
  io: Io,
  args: SaveGroupBannerArgs,
): Promise<GroupBannerUploadResult> {
  const { userId, buffer, now } = args;

  const since = now.getTime() - DAY_MS;
  const recent = (uploadTimesByUser.get(userId) ?? []).filter((at) => at > since);
  if (recent.length >= UPLOAD_DAILY_LIMIT) {
    uploadTimesByUser.set(userId, recent);
    return { status: "rate_limited", limit: UPLOAD_DAILY_LIMIT };
  }

  const encoded = await reencode(io, buffer);
  if (!encoded) {
    return { status: "not_an_image" };
  }

  const name = `${uuidv7()}.webp`;
  await io.fs.mkdir(GROUP_BANNER_MEDIA_DIR, { recursive: true });
  await io.fs.writeFile(join(GROUP_BANNER_MEDIA_DIR, name), encoded);

  recent.push(now.getTime());
  uploadTimesByUser.set(userId, recent);

  return { status: "ok", url: `${URL_PREFIX}${name}` };
}

export async function deleteGroupBanner(io: Io, url: string | null): Promise<void> {
  if (!url || !isGroupBannerUrl(url)) {
    return;
  }
  const name = url.slice(URL_PREFIX.length);
  // oxlint-disable-next-line no-empty-function -- swallow missing-file errors
  await io.fs.unlink(join(GROUP_BANNER_MEDIA_DIR, name)).catch(() => {});
}
