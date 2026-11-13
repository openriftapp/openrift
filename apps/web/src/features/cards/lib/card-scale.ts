import { clamp } from "@openrift/shared/math";
import { CARD_SCALE } from "@openrift/shared/overlay-scale";

export function clampCardScale(scale: number): number {
  if (!Number.isFinite(scale)) {
    return CARD_SCALE.max;
  }
  return clamp(scale, CARD_SCALE.min, CARD_SCALE.max);
}
