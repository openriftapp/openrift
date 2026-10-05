/**
 * Aim coaching for the scanning page: one short line telling the user what to
 * change when the guide is not producing locks.
 */

import { DEFAULT_ALIGNED_OPTIONS } from "@openrift/shared/scan/accept";
import {
  ARCFACE_GATES,
  MOBILECLIP_GATES,
  ROTATION_MIN_FOCUS,
} from "@openrift/shared/scan/session-options";

import { m } from "@/paraglide/messages.js";

interface AimPoint {
  x: number;
  y: number;
}

export type AimHintKind =
  | "settling"
  | "no-card"
  | "too-far"
  | "too-close"
  | "blurry"
  | "checking"
  | "glare"
  | "almost";

export interface AimHint {
  kind: AimHintKind;
  message: string;
}

export function aimHintMessage(kind: AimHintKind): string {
  switch (kind) {
    case "settling": {
      return m.scan_aim_settling();
    }
    case "no-card": {
      return m.scan_aim_no_card();
    }
    case "too-far": {
      return m.scan_aim_too_far();
    }
    case "too-close": {
      return m.scan_aim_too_close();
    }
    case "blurry": {
      return m.scan_aim_blurry();
    }
    case "checking": {
      return m.scan_aim_checking();
    }
    case "glare": {
      return m.scan_aim_glare();
    }
    case "almost": {
      return m.scan_aim_almost();
    }
  }
}

const MIN_AREA_FRACTION = 0.45;
const MAX_AREA_FRACTION = 1.6;

/** Percent. */
const ALMOST_MIN_SCORE = 30;
const ALMOST_MAX_SCORE = DEFAULT_ALIGNED_OPTIONS.minScore * 100 - 3;
const NO_MATCH_BELOW_SCORE = 3;

const PLAUSIBLE_DISTANCE = Math.max(
  ARCFACE_GATES.rotationFallbackDistance,
  MOBILECLIP_GATES.rotationFallbackDistance,
);

export interface AimHintInput {
  active: boolean;
  hasCandidate: boolean;
  candidateAreaFraction: number;
  bestScore: number;
  focus: number;
  topDistance?: number;
  refused: boolean;
  isWinner: boolean;
  plausibleDistance?: number;
  settling?: boolean;
}

export function polygonArea(polygon: readonly AimPoint[]): number {
  let sum = 0;
  let previous = polygon.at(-1);
  for (const point of polygon) {
    if (previous !== undefined) {
      sum += previous.x * point.y - point.x * previous.y;
    }
    previous = point;
  }
  return Math.abs(sum) / 2;
}

export function areaFractionOfGuide(
  candidate: readonly AimPoint[],
  guide: readonly AimPoint[],
): number {
  const guideArea = polygonArea(guide);
  if (guideArea <= 0) {
    return 0;
  }
  return polygonArea(candidate) / guideArea;
}

/** Checked in priority order; only the first match is shown, so reordering changes which hint wins. */
export function deriveAimHint(input: AimHintInput): AimHint | null {
  if (!input.active || input.isWinner) {
    return null;
  }
  if (input.settling) {
    return hint("settling");
  }
  if (!input.hasCandidate) {
    return hint("no-card");
  }
  if (input.candidateAreaFraction < MIN_AREA_FRACTION) {
    return hint("too-far");
  }
  if (input.candidateAreaFraction > MAX_AREA_FRACTION) {
    return hint("too-close");
  }
  // focus 0 is "not measured this frame", not a perfectly blurry frame.
  if (input.focus > 0 && input.focus < ROTATION_MIN_FOCUS) {
    return hint("blurry");
  }
  if (input.refused) {
    return hint("checking");
  }
  const gate = input.plausibleDistance ?? PLAUSIBLE_DISTANCE;
  const implausible = input.topDistance === undefined || input.topDistance > gate;
  if (input.bestScore < NO_MATCH_BELOW_SCORE && implausible) {
    return hint("no-card");
  }
  if (input.bestScore < ALMOST_MIN_SCORE && implausible) {
    return hint("glare");
  }
  if (input.bestScore >= ALMOST_MIN_SCORE && input.bestScore <= ALMOST_MAX_SCORE) {
    return hint("almost");
  }
  return null;
}

function hint(kind: AimHintKind): AimHint {
  return { kind, message: aimHintMessage(kind) };
}

export interface AimHintSmootherOptions {
  appearAfterMs?: number;
  minVisibleMs?: number;
}

const DEFAULT_APPEAR_AFTER_MS = 350;
const DEFAULT_MIN_VISIBLE_MS = 1200;

export interface AimHintSmoother {
  update: (hint: AimHint | null, now: number) => AimHint | null;
  reset: () => void;
}

export function createAimHintSmoother(options?: AimHintSmootherOptions): AimHintSmoother {
  const appearAfterMs = options?.appearAfterMs ?? DEFAULT_APPEAR_AFTER_MS;
  const minVisibleMs = options?.minVisibleMs ?? DEFAULT_MIN_VISIBLE_MS;

  let visible: AimHint | null = null;
  let visibleSince = 0;
  // pending === null with hasPending true means a pending clear.
  let pending: AimHint | null = null;
  let pendingSince = 0;
  let hasPending = false;

  return {
    update(next: AimHint | null, now: number): AimHint | null {
      if (next?.kind === visible?.kind) {
        hasPending = false;
        pending = null;
        return visible;
      }
      if (!hasPending || pending?.kind !== next?.kind) {
        pending = next;
        pendingSince = now;
        hasPending = true;
      }
      const dwelled = now - pendingSince >= appearAfterMs;
      const settled = visible === null || now - visibleSince >= minVisibleMs;
      if (dwelled && settled) {
        visible = pending;
        visibleSince = now;
        hasPending = false;
        pending = null;
      }
      return visible;
    },
    reset(): void {
      visible = null;
      visibleSince = 0;
      pending = null;
      pendingSince = 0;
      hasPending = false;
    },
  };
}
