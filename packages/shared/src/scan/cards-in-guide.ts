/**
 * Narrows detector outlines to separate, whole cards inside the guide area,
 * each smaller than a card being aimed.
 */
import { distinctWholeOutlines } from "./distinct-outlines";
import { boundingBox, quadArea } from "./geometry";
import { SWEEP_MIN_SCORE, SWEEP_OPTIONS, isAimedCard } from "./sweep";
import type { CardCandidate, Quad } from "./types";

/** Share of a card's bounding box. */
const IN_GUIDE = 0.5;

export function cardsInGuide(
  candidates: readonly CardCandidate[],
  guide: Quad,
  frame: { width: number; height: number },
): Quad[] {
  const guideArea = quadArea(guide);
  const guideBox = boundingBox(guide);
  const inGuide = (quad: Quad): boolean => {
    const box = boundingBox(quad);
    const overlapWidth = Math.min(box.maxX, guideBox.maxX) - Math.max(box.minX, guideBox.minX);
    const overlapHeight = Math.min(box.maxY, guideBox.maxY) - Math.max(box.minY, guideBox.minY);
    const boxArea = (box.maxX - box.minX) * (box.maxY - box.minY);
    return (
      overlapWidth > 0 && overlapHeight > 0 && (overlapWidth * overlapHeight) / boxArea >= IN_GUIDE
    );
  };
  const small = candidates.filter(
    (candidate) =>
      !isAimedCard(candidate.quad, guideArea, SWEEP_OPTIONS.aimedShare) && inGuide(candidate.quad),
  );
  return distinctWholeOutlines(small, { minScore: SWEEP_MIN_SCORE, frame }).map(
    (candidate) => candidate.quad,
  );
}
