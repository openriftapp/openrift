/* oxlint-disable import/no-nodejs-modules -- standalone CLI tooling, never bundled */
/**
 * Pre-draws card outlines for the outline-labels admin page: learned detector
 * outlines, tiled on large images and snapped to edges. Writes
 * proposals.json into the frame folder.
 *
 * Usage: SCAN_BOARD_DETECTOR=... bun scripts/scan/outline-proposals.ts frame-folder
 */
import fs from "node:fs";
import path from "node:path";

import { BOARD_TILE, detectTiled } from "../../packages/shared/src/scan/board.js";
import { snapQuadToEdges } from "../../packages/shared/src/scan/edge-snap.js";
import { mapQuad, quadIou } from "../../packages/shared/src/scan/geometry.js";
import { toGray } from "../../packages/shared/src/scan/image.js";
import type { Quad } from "../../packages/shared/src/scan/types.js";
import { createBoardDetector } from "./board-model";
import { loadImage } from "./lib";

const folder = process.argv[2];
const modelFile = process.env.SCAN_BOARD_DETECTOR;
if (!folder || !modelFile) {
  process.stderr.write(
    "usage: SCAN_BOARD_DETECTOR=... bun scripts/scan/outline-proposals.ts frame-folder\n",
  );
  process.exit(2);
}

async function main(): Promise<void> {
  const detect = createBoardDetector(modelFile as string);
  const frames: Record<string, Quad[]> = {};
  const files = fs
    .readdirSync(folder as string)
    .filter((file) => file.endsWith(".jpg"))
    .toSorted();
  for (const file of files) {
    const image = await loadImage(path.join(folder as string, file));
    const longSide = Math.max(image.width, image.height);
    const outlines =
      longSide > BOARD_TILE * 1.25 ? await detectTiled(image, detect) : await detect(image);
    const gray = toGray(image);
    const learned = outlines.map((outline) => snapQuadToEdges(gray, outline.quad));
    const kept: Quad[] = [];
    for (const quad of learned) {
      if (!kept.some((other) => quadIou(quad, other) > 0.5)) {
        kept.push(quad);
      }
    }
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
