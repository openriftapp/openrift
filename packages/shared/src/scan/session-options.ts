import type { AcceptOptions } from "./accept";
import type { EmbedBank } from "./embed";
import { bankEmbedDim } from "./embed";
import type { Quad } from "./types";
import { CARD_ASPECT } from "./types";

export const SESSION_UNWARP_WIDTH = 384;
export const SESSION_UNWARP_HEIGHT = 528;
export const SWEEP_TOP_K = 6;
export const IDLE_AFTER_NO_WINNER_FRAMES = 5;
export const MIN_FOCUS = 12;
export const ROTATION_MIN_FOCUS = 40;

export interface ScanSessionOptions {
  topK: number;
  candidatesToTry: number;
  confidentDistance: number;
  rotationFallbackDistance: number;
  rotationPairOnly: boolean;
  accept: AcceptOptions;
  sweep: boolean;
}

export function centeredGuideQuad(width: number, height: number): Quad {
  let cardHeight = 0.7 * height;
  let cardWidth = cardHeight * CARD_ASPECT;
  if (cardWidth > 0.9 * width) {
    cardWidth = 0.9 * width;
    cardHeight = cardWidth / CARD_ASPECT;
  }
  const left = (width - cardWidth) / 2;
  const top = (height - cardHeight) / 2;
  return [
    { x: left, y: top },
    { x: left + cardWidth, y: top },
    { x: left + cardWidth, y: top + cardHeight },
    { x: left, y: top + cardHeight },
  ];
}

export interface EncoderGates {
  confidentDistance: number;
  rotationFallbackDistance: number;
  slowRotationFallbackDistance: number;
  topK: number;
}

export const MOBILECLIP_GATES: EncoderGates = {
  confidentDistance: 0.22,
  rotationFallbackDistance: 0.35,
  slowRotationFallbackDistance: 0.45,
  topK: 8,
};

export const ARCFACE_GATES: EncoderGates = {
  confidentDistance: 0.35,
  rotationFallbackDistance: 0.42,
  slowRotationFallbackDistance: 0.42,
  topK: 2,
};

/** A 256-dimensional bank comes from the custom ArcFace encoder, any other from MobileCLIP-S0. */
export function gatesForEmbedDim(dim: number): EncoderGates {
  return dim === 256 ? ARCFACE_GATES : MOBILECLIP_GATES;
}

export const DEFAULT_SESSION_OPTIONS: ScanSessionOptions = {
  topK: MOBILECLIP_GATES.topK,
  candidatesToTry: 4,
  confidentDistance: MOBILECLIP_GATES.confidentDistance,
  rotationFallbackDistance: MOBILECLIP_GATES.rotationFallbackDistance,
  rotationPairOnly: false,
  accept: { lockRun: 4, maxGapFrames: 6 },
  sweep: false,
};

export function gatesForBank(bank: EmbedBank): EncoderGates {
  return gatesForEmbedDim(bankEmbedDim(bank));
}
