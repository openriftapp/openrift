// oxlint-disable-next-line import/no-nodejs-modules -- server-side file needs filesystem access
import { existsSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules -- server-side file needs filesystem path join
import { dirname, join } from "node:path";

import { v7 as uuidv7 } from "uuid";

import type { Io } from "../io.js";

function findProjectRoot(): string {
  const start = import.meta.dirname;
  if (!start) {
    throw new Error("import.meta.dirname is not available");
  }
  for (let dir = start; dir !== dirname(dir); dir = dirname(dir)) {
    if (existsSync(join(dir, "bun.lock"))) {
      return dir;
    }
  }
  throw new Error("Could not find project root (no bun.lock found)");
}

export const MEDIA_DIR = join(findProjectRoot(), "media");

const DAY_MS = 24 * 60 * 60 * 1000;

export type MediaUploadResult =
  | { status: "ok"; url: string }
  | { status: "not_an_image" }
  | { status: "rate_limited"; limit: number };

export interface MediaUploadStore {
  dir: string;
  urlPrefix: string;
  save: (io: Io, args: { userId: string; buffer: Buffer; now: Date }) => Promise<MediaUploadResult>;
  /** The file name under `dir` for a URL the caller already validated as this store's. */
  fileName: (url: string) => string;
  remove: (io: Io, url: string) => Promise<void>;
}

/**
 * nginx serves `media/<subdir>/` publicly; the uuid filename is the only thing keeping an
 * upload unlisted. The daily limit is per user and per process.
 */
export function createMediaUploadStore(options: {
  subdir: string;
  dailyLimit: number;
  encode: (io: Io, buffer: Buffer) => Promise<{ data: Buffer; ext: string } | null>;
}): MediaUploadStore {
  const dir = join(MEDIA_DIR, options.subdir);
  const urlPrefix = `/media/${options.subdir}/`;
  const uploadTimesByUser = new Map<string, number[]>();

  const fileName = (url: string) => url.slice(urlPrefix.length);

  return {
    dir,
    urlPrefix,
    fileName,
    async save(io, { userId, buffer, now }) {
      const since = now.getTime() - DAY_MS;
      const recent = (uploadTimesByUser.get(userId) ?? []).filter((at) => at > since);
      if (recent.length >= options.dailyLimit) {
        uploadTimesByUser.set(userId, recent);
        return { status: "rate_limited", limit: options.dailyLimit };
      }

      const encoded = await options.encode(io, buffer);
      if (!encoded) {
        return { status: "not_an_image" };
      }

      const name = `${uuidv7()}.${encoded.ext}`;
      await io.fs.mkdir(dir, { recursive: true });
      await io.fs.writeFile(join(dir, name), encoded.data);

      recent.push(now.getTime());
      uploadTimesByUser.set(userId, recent);

      return { status: "ok", url: `${urlPrefix}${name}` };
    },
    async remove(io, url) {
      // oxlint-disable-next-line no-empty-function -- swallow missing-file errors
      await io.fs.unlink(join(dir, fileName(url))).catch(() => {});
    },
  };
}
