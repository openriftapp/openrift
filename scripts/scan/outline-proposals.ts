/**
 * Pre-draws card outlines for the outline-labels admin page: the outlines a tap
 * read proposes, snapped to edges. Writes
 * proposals.json into the frame folder.
 *
 * Usage: SCAN_BOARD_DETECTOR=... bun scripts/scan/outline-proposals.ts frame-folder
 */
import fs from "node:fs";
import path from "node:path";

import { detectOutlinesInPhoto } from "../../packages/shared/src/scan/board.js";
import { distinctWholeOutlines } from "../../packages/shared/src/scan/distinct-outlines.js";
import { snapQuadToEdges } from "../../packages/shared/src/scan/edge-snap.js";
import { mapQuad } from "../../packages/shared/src/scan/geometry.js";
import { toGray } from "../../packages/shared/src/scan/image.js";
import type { Quad } from "../../packages/shared/src/scan/types.js";
import { createBoardDetector } from "./board-model";
import { listFrames, loadImage, servedModel } from "./lib";

const folder = process.argv[2];
const modelFile = servedModel("SCAN_BOARD_DETECTOR", "SCAN_BOARD_DETECTOR_FILE");
if (!folder || !modelFile) {
  process.stderr.write(
    "usage: SCAN_BOARD_DETECTOR=... bun scripts/scan/outline-proposals.ts frame-folder\n",
  );
  process.exit(2);
}

async function main(): Promise<void> {
  const detect = createBoardDetector(modelFile as string);
  const frames: Record<string, Quad[]> = {};
  const files = listFrames(folder as string);
  for (const file of files) {
    const image = await loadImage(path.join(folder as string, file));
    const gray = toGray(image);
    const detected = await detectOutlinesInPhoto(image, detect);
    const snapped = detected.map((outline) => ({
      ...outline,
      quad: snapQuadToEdges(gray, outline.quad),
    }));
    const kept = distinctWholeOutlines(snapped).map((outline) => outline.quad);
    frames[file] = kept.map((quad) =>
      mapQuad(quad, (point) => ({ x: Math.round(point.x), y: Math.round(point.y) })),
    );
    process.stdout.write(`${file}: ${kept.length} outlines\n`);
  }
  fs.writeFileSync(
    path.join(folder as string, "proposals.json"),
    `${JSON.stringify({ version: 1, frames }, null, 1)}\n`,
  );
}

await main();
