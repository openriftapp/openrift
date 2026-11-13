import { clamp } from "./math.js";

/** A stream overlay card's height, as a percentage of the frame. */
export const OVERLAY_SCALE = { min: 20, max: 100, step: 5 } as const;

/** The presented card's size as a fraction of its full size. */
export const CARD_SCALE = { min: 0.4, max: 1 } as const;

export const TIER_TILE_STEPS = 6;

export function clampRevealCount(revealCount: number, total: number): number {
  return clamp(revealCount, 0, Math.max(total, 0));
}
