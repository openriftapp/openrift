/* oxlint-disable import/no-nodejs-modules -- standalone CLI tooling, never bundled */
/**
 * Publishes the labelled clips under media/scan-bench so the device bench on
 * /admin/scan-bench can replay them through the dev server. Frames are symlinked,
 * not copied.
 *
 * Usage: bun scripts/scan/export-bench-pack.ts
 */
import fs from "node:fs";
import path from "node:path";

import type { PackClip } from "../../packages/shared/src/scan/bench-score.js";
import { CLIPS, REPO_ROOT, listClips, loadClipTruth } from "./lib";

const PACK_DIR = path.join(REPO_ROOT, "media/scan-bench");

fs.mkdirSync(PACK_DIR, { recursive: true });
const clips: PackClip[] = [];
for (const clip of listClips()) {
  const truth = loadClipTruth(clip);
  if (!truth) {
    continue;
  }
  const source = path.join(CLIPS, clip);
  const frames = fs.readdirSync(source).filter((file) => file.endsWith(".jpg")).length;
  const link = path.join(PACK_DIR, clip);
  fs.rmSync(link, { recursive: true, force: true });
  fs.symlinkSync(fs.realpathSync(source), link, "dir");
  clips.push({ clip, frames, truth });
}
fs.writeFileSync(path.join(PACK_DIR, "index.json"), `${JSON.stringify({ clips }, null, 2)}\n`);
process.stdout.write(`${clips.length} clips published to ${PACK_DIR}\n`);
