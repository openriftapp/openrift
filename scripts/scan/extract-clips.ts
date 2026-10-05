/* oxlint-disable import/no-nodejs-modules -- standalone CLI tooling, never bundled */
/**
 * Rebuilds the bench frames under clips/full from the archived recordings.
 * Skips clips whose frames already exist unless --force is given.
 *
 * Usage: bun scripts/scan/extract-clips.ts [--force]
 */
import fs from "node:fs";
import path from "node:path";

import { CLIPS, RECORDINGS_DIR, extractClipFrames, hasFlag } from "./lib";

const force = hasFlag("--force");
const recordings = fs.existsSync(RECORDINGS_DIR)
  ? fs.readdirSync(RECORDINGS_DIR).filter((file) => file.endsWith(".mp4"))
  : [];
if (recordings.length === 0) {
  process.stdout.write(`no recordings in ${RECORDINGS_DIR}\n`);
}
for (const file of recordings.toSorted()) {
  const clip = path.basename(file, ".mp4");
  if (!force && fs.existsSync(path.join(CLIPS, clip))) {
    process.stdout.write(`${clip}: frames present, skipped\n`);
    continue;
  }
  process.stdout.write(`${clip}: ${extractClipFrames(clip)} frames\n`);
}
