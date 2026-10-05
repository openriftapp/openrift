import { clampPageLimit } from "../../../lib/xid-watermark.js";

const COPIES_PAGE_MAX = 5000;

export function clampCopiesLimit(limit?: number): number {
  return clampPageLimit(limit, COPIES_PAGE_MAX);
}
