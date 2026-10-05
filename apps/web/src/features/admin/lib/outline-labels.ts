/**
 * Hand-checked card outlines for detector training: one entry per frame, the
 * card quads in image pixels and whether every card in the frame is outlined.
 */
import { CARD_ASPECT } from "@openrift/shared/scan/types";

export interface OutlineLabelPoint {
  x: number;
  y: number;
}

export type OutlineLabelQuad = [
  OutlineLabelPoint,
  OutlineLabelPoint,
  OutlineLabelPoint,
  OutlineLabelPoint,
];

export interface FrameOutlineLabel {
  cards: OutlineLabelQuad[];
  done: boolean;
}

export type FrameOutlineLabels = Record<string, FrameOutlineLabel>;

function isQuad(value: unknown): value is OutlineLabelQuad {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(
      (point: unknown) =>
        typeof point === "object" &&
        point !== null &&
        typeof (point as OutlineLabelPoint).x === "number" &&
        typeof (point as OutlineLabelPoint).y === "number",
    )
  );
}

export function outlineLabelsFromProposals(json: unknown): FrameOutlineLabels {
  const frames = (json as { frames?: Record<string, unknown> } | null)?.frames;
  if (typeof frames !== "object" || frames === null) {
    return {};
  }
  const labels: FrameOutlineLabels = {};
  for (const [name, quads] of Object.entries(frames)) {
    labels[name] = {
      cards: Array.isArray(quads) ? quads.filter((quad) => isQuad(quad)) : [],
      done: false,
    };
  }
  return labels;
}

export function outlineLabelsFromSaved(json: unknown): FrameOutlineLabels {
  const frames = (json as { frames?: Record<string, unknown> } | null)?.frames;
  if (typeof frames !== "object" || frames === null) {
    return {};
  }
  const labels: FrameOutlineLabels = {};
  for (const [name, value] of Object.entries(frames)) {
    const entry = value as { cards?: unknown; done?: unknown } | null;
    labels[name] = {
      cards: Array.isArray(entry?.cards) ? entry.cards.filter((quad) => isQuad(quad)) : [],
      done: entry?.done === true,
    };
  }
  return labels;
}

export function moveCorner(
  label: FrameOutlineLabel,
  card: number,
  corner: number,
  to: OutlineLabelPoint,
): FrameOutlineLabel {
  return {
    ...label,
    cards: label.cards.map((quad, index) =>
      index === card
        ? (quad.map((point, pointIndex) =>
            pointIndex === corner ? to : point,
          ) as OutlineLabelQuad)
        : quad,
    ),
  };
}

export function addCard(
  label: FrameOutlineLabel,
  width: number,
  height: number,
): FrameOutlineLabel {
  const cardHeight = height / 5;
  const cardWidth = cardHeight * CARD_ASPECT;
  const left = (width - cardWidth) / 2;
  const top = (height - cardHeight) / 2;
  const quad: OutlineLabelQuad = [
    { x: left, y: top },
    { x: left + cardWidth, y: top },
    { x: left + cardWidth, y: top + cardHeight },
    { x: left, y: top + cardHeight },
  ];
  return { ...label, cards: [...label.cards, quad] };
}

export function removeCard(label: FrameOutlineLabel, card: number): FrameOutlineLabel {
  return { ...label, cards: label.cards.filter((_, index) => index !== card) };
}

/** In image pixels. */
export function outlineLabelMargin(
  cards: readonly OutlineLabelQuad[],
  size: { width: number; height: number },
): number {
  let overshoot = 0;
  for (const point of cards.flat()) {
    overshoot = Math.max(
      overshoot,
      -point.x,
      -point.y,
      point.x - size.width,
      point.y - size.height,
    );
  }
  return Math.round(overshoot + Math.max(size.width, size.height) / 3);
}

export function serializeOutlineLabels(labels: FrameOutlineLabels): string {
  return `${JSON.stringify({ version: 1, frames: labels }, null, 1)}\n`;
}

export function outlineLabelFolder(files: readonly { name: string; size: number }[]): string {
  return files
    .map((file) => `${file.name}:${file.size}`)
    .toSorted()
    .join("\n");
}

export function outlineLabelStorageKey(folder: string): string {
  let hash = 0x81_1c_9d_c5;
  for (let index = 0; index < folder.length; index++) {
    // oxlint-disable-next-line unicorn/prefer-code-point -- FNV-1a hashes UTF-16 units
    hash = Math.imul(hash ^ folder.charCodeAt(index), 0x01_00_01_93) >>> 0;
  }
  return `openrift-scan-labels:${hash.toString(16)}`;
}

export function serializeStoredOutlineLabels(folder: string, labels: FrameOutlineLabels): string {
  return JSON.stringify({ version: 1, folder, frames: labels });
}

export function storedOutlineLabelsFor(json: unknown, folder: string): FrameOutlineLabels {
  if ((json as { folder?: unknown } | null)?.folder !== folder) {
    return {};
  }
  return outlineLabelsFromSaved(json);
}

/** Neither source carries timestamps, so the autosave wins a conflict; `keptAutosave` counts those frames. */
export function mergeOpenedOutlineLabels(
  proposals: FrameOutlineLabels,
  stored: FrameOutlineLabels,
  saved: FrameOutlineLabels,
): { labels: FrameOutlineLabels; keptAutosave: number } {
  const keptAutosave = Object.entries(stored).filter(
    ([name, label]) =>
      saved[name] !== undefined && JSON.stringify(saved[name]) !== JSON.stringify(label),
  ).length;
  return { labels: { ...proposals, ...saved, ...stored }, keptAutosave };
}

export function doneCount(labels: FrameOutlineLabels): number {
  return Object.values(labels).filter((label) => label.done).length;
}
