import type { Io } from "../../../../io.js";
import type { ImageFingerprint } from "../../../../lib/image-fingerprint.js";
import {
  decodeFingerprint,
  differenceHash,
  encodeFingerprint,
  FINGERPRINT_LONG_EDGE,
  FINGERPRINT_SHORT_EDGE,
  MARK_BOX,
  MARK_HEIGHT,
  MARK_SHIFT,
  MARK_STORED_HEIGHT,
  MARK_STORED_WIDTH,
  MARK_WIDTH,
  WHOLE_HASH_COLS,
  WHOLE_HASH_ROWS,
  wholeDistance,
} from "../../../../lib/image-fingerprint.js";

export type FingerprintRotation = 0 | 90 | 270;

export async function computeImageFingerprint(
  io: Io,
  buffer: Buffer,
  rotation: FingerprintRotation = 0,
): Promise<string> {
  let image = io.sharp(buffer).autoOrient().flatten({ background: "#fff" }).grayscale();
  const meta = await image.clone().metadata();
  let width = meta.autoOrient.width;
  let height = meta.autoOrient.height;
  if (rotation !== 0) {
    image = image.rotate(rotation);
    [width, height] = [height, width];
  }
  const landscape = width > height;
  const w = landscape ? FINGERPRINT_LONG_EDGE : FINGERPRINT_SHORT_EDGE;
  const h = landscape ? FINGERPRINT_SHORT_EDGE : FINGERPRINT_LONG_EDGE;
  const grey = await image.resize(w, h, { fit: "fill" }).raw().toBuffer();
  const raw = { width: w, height: h, channels: 1 as const };

  const grid = await io
    .sharp(grey, { raw })
    .resize(WHOLE_HASH_COLS, WHOLE_HASH_ROWS, { fit: "fill" })
    .toColourspace("b-w")
    .raw()
    .toBuffer();

  const left = Math.round(MARK_BOX.x0 * w);
  const top = Math.round(MARK_BOX.y0 * h);
  const cropWidth = Math.round((MARK_BOX.x1 - MARK_BOX.x0) * w);
  const cropHeight = Math.round((MARK_BOX.y1 - MARK_BOX.y0) * h);
  const padX = Math.round((cropWidth * MARK_SHIFT) / MARK_WIDTH);
  const padY = Math.round((cropHeight * MARK_SHIFT) / MARK_HEIGHT);
  const x = Math.max(0, left - padX);
  const y = Math.max(0, top - padY);
  const mark = await io
    .sharp(grey, { raw })
    .extract({
      left: x,
      top: y,
      width: Math.min(w - x, cropWidth + 2 * padX),
      height: Math.min(h - y, cropHeight + 2 * padY),
    })
    .resize(MARK_STORED_WIDTH, MARK_STORED_HEIGHT, { fit: "fill" })
    .toColourspace("b-w")
    .raw()
    .toBuffer();

  return encodeFingerprint({
    landscape,
    hash: differenceHash(new Uint8Array(grid), WHOLE_HASH_COLS, WHOLE_HASH_ROWS),
    mark: new Uint8Array(mark),
  });
}

/** Sources ship battlefields in either orientation; the quarter turn closer to the live image wins. */
export async function computeCandidateFingerprint(
  io: Io,
  buffer: Buffer,
  liveEncoded: string | null,
): Promise<string> {
  const native = await computeImageFingerprint(io, buffer, 0);
  const live = liveEncoded === null ? null : decodeFingerprint(liveEncoded);
  const decodedNative = decodeFingerprint(native) as ImageFingerprint;
  if (!live || live.landscape === decodedNative.landscape) {
    return native;
  }
  const [quarter, threeQuarter] = await Promise.all([
    computeImageFingerprint(io, buffer, 90),
    computeImageFingerprint(io, buffer, 270),
  ]);
  const a = decodeFingerprint(quarter) as ImageFingerprint;
  const b = decodeFingerprint(threeQuarter) as ImageFingerprint;
  return wholeDistance(a, live) <= wholeDistance(b, live) ? quarter : threeQuarter;
}
