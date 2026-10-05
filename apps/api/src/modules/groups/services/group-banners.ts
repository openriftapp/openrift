import type { Io } from "../../../io.js";
import type { MediaUploadResult } from "../../../lib/media-upload.js";
import { createMediaUploadStore } from "../../../lib/media-upload.js";
import { GROUP_BANNER_WIDTH, isGroupBannerUrl } from "../lib/group-banner.js";

const WEBP_QUALITY = 82;

export type GroupBannerUploadResult = MediaUploadResult;

interface SaveGroupBannerArgs {
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
    const data = await io
      .sharp(buffer)
      .rotate()
      .resize(GROUP_BANNER_WIDTH, undefined, { withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    return { data, ext: "webp" };
  } catch {
    return null;
  }
}

const store = createMediaUploadStore({
  subdir: "group-banners",
  dailyLimit: 30,
  encode: reencode,
});

export const GROUP_BANNER_MEDIA_DIR = store.dir;

// The group page is members-only, but its banner file is public to anyone with the URL.
export function saveGroupBanner(
  io: Io,
  args: SaveGroupBannerArgs,
): Promise<GroupBannerUploadResult> {
  return store.save(io, args);
}

export async function deleteGroupBanner(io: Io, url: string | null): Promise<void> {
  if (!url || !isGroupBannerUrl(url)) {
    return;
  }
  await store.remove(io, url);
}
