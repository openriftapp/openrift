/**
 * Identifies every card in one still photo: tiles for the detector, an
 * aligned check per outline cut from the full-resolution photo, and one card
 * per position on the table.
 */
import type { AlignedOptions } from "./accept";
import { DEFAULT_ALIGNED_OPTIONS, pickAlignedWinner } from "./accept";
import type { AlignedVerifier } from "./aligned-verify";
import { createAlignedVerifier } from "./aligned-verify";
import type { PrintingIdentity } from "./disambiguate";
import { distinctWholeOutlines, samePosition } from "./distinct-outlines";
import type { CardEmbedder, EmbedBank } from "./embed";
import { rankCardEmbedding } from "./embed";
import { mapQuad } from "./geometry";
import type { PrintingReader } from "./printing-lock";
import { createPrintingReader, unanimousPick } from "./printing-lock";
import { SESSION_UNWARP_HEIGHT, SESSION_UNWARP_WIDTH } from "./session-options";
import type { CardCandidate, Quad, RgbaImage } from "./types";
import { unwarpCard, unwarpQuad } from "./unwarp";

export interface BoardTile {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function boardTiles(width: number, height: number, tileSize: number): BoardTile[] {
  const starts = (length: number) => {
    if (length <= tileSize) {
      return [0];
    }
    const count = Math.ceil((length - tileSize) / (tileSize / 2)) + 1;
    const step = (length - tileSize) / (count - 1);
    return Array.from({ length: count }, (_, index) => Math.round(index * step));
  };
  return starts(height).flatMap((y) =>
    starts(width).map((x) => ({
      x,
      y,
      width: Math.min(tileSize, width),
      height: Math.min(tileSize, height),
    })),
  );
}

export function cropImage(image: RgbaImage, tile: BoardTile): RgbaImage {
  const data = new Uint8ClampedArray(tile.width * tile.height * 4);
  for (let y = 0; y < tile.height; y++) {
    const from = ((tile.y + y) * image.width + tile.x) * 4;
    data.set(image.data.subarray(from, from + tile.width * 4), y * tile.width * 4);
  }
  return { data, width: tile.width, height: tile.height };
}

/** Pixels. */
const TILE_EDGE_MARGIN = 3;

export function outlinesFromTiles(
  photo: { width: number; height: number },
  tiles: readonly { tile: BoardTile; candidates: readonly CardCandidate[] }[],
): CardCandidate[] {
  const out: CardCandidate[] = [];
  for (const { tile, candidates } of tiles) {
    for (const candidate of candidates) {
      const quad = mapQuad(candidate.quad, (point) => ({
        x: point.x + tile.x,
        y: point.y + tile.y,
      }));
      const cut = quad.some(
        (point) =>
          (point.x < tile.x + TILE_EDGE_MARGIN && tile.x > 0) ||
          (point.y < tile.y + TILE_EDGE_MARGIN && tile.y > 0) ||
          (point.x > tile.x + tile.width - TILE_EDGE_MARGIN && tile.x + tile.width < photo.width) ||
          (point.y > tile.y + tile.height - TILE_EDGE_MARGIN &&
            tile.y + tile.height < photo.height),
      );
      if (!cut) {
        out.push({ ...candidate, quad });
      }
    }
  }
  return out;
}

export interface BoardCard {
  key: string;
  artKey: string;
  quad: Quad;
  score: number;
  rivalScore: number;
  distance: number;
  confident: boolean;
  alternatives: string[];
  printingResolved: boolean;
}

export interface BoardDeps {
  embedder: CardEmbedder;
  bank: EmbedBank;
  embedImageSize: number;
  artKeyOf: (key: string) => string;
  fetchReference: (key: string) => Promise<RgbaImage | null>;
  /** Both given, the read also picks each card's printing. */
  labelOf?: (key: string) => string;
  identityOf?: (key: string) => PrintingIdentity | undefined;
}

export interface BoardOptions {
  topK: number;
  confidentDistance: number;
  rotationFallbackDistance: number;
  rotationPairOnly: boolean;
  aligned: AlignedOptions;
  wideSearchDistance: number;
  confidentMargin: number;
  wideTopK: number;
  alternativeBand: number;
}

export const DEFAULT_BOARD_OPTIONS: Omit<
  BoardOptions,
  "topK" | "confidentDistance" | "rotationFallbackDistance" | "rotationPairOnly"
> = {
  aligned: { ...DEFAULT_ALIGNED_OPTIONS, minMargin: 0 },
  wideSearchDistance: 0.45,
  confidentMargin: 0.1,
  wideTopK: 12,
  alternativeBand: 0.1,
};

export function boardOptionsFor(
  gates: Pick<BoardOptions, "confidentDistance" | "rotationFallbackDistance">,
  canonical: boolean,
): BoardOptions {
  return {
    ...DEFAULT_BOARD_OPTIONS,
    topK: 3,
    confidentDistance: gates.confidentDistance,
    rotationFallbackDistance: gates.rotationFallbackDistance,
    rotationPairOnly: canonical,
  };
}

async function readPrinting(
  readPrintingOf: PrintingReader | null,
  winner: { key: string; artKey: string },
  crop: RgbaImage,
  rotation: number,
  deps: BoardDeps,
): Promise<string | null> {
  const { labelOf, identityOf } = deps;
  if (!readPrintingOf || !labelOf || !identityOf) {
    return null;
  }
  const read = await readPrintingOf(winner.artKey, winner.key, crop, rotation);
  const picked = read?.picked;
  return picked && unanimousPick(picked, { labelOf, identityOf }) ? picked.key : null;
}

async function identifyOutline(
  photo: RgbaImage,
  quad: Quad,
  verify: AlignedVerifier,
  readPrintingOf: PrintingReader | null,
  deps: BoardDeps,
  options: BoardOptions,
): Promise<BoardCard | null> {
  const crop = unwarpCard(photo, quad, SESSION_UNWARP_WIDTH, SESSION_UNWARP_HEIGHT, 0);
  if (!crop) {
    return null;
  }
  const rank = (topK: number) =>
    rankCardEmbedding(crop, deps.embedder, deps.bank, {
      topK,
      confidentDistance: options.confidentDistance,
      rotationFallbackDistance: options.rotationFallbackDistance,
      imageSize: deps.embedImageSize,
      pairOnly: options.rotationPairOnly,
    });
  let ranked = await rank(options.topK);
  const close = (ranked[0]?.distance ?? 1) <= options.wideSearchDistance;
  if (!close) {
    ranked = await rank(options.wideTopK);
  }
  const { scores, failed } = await verify(crop, ranked);
  const decision = pickAlignedWinner(scores, deps.artKeyOf, options.aligned);
  const winner = decision.winner;
  if (!winner) {
    return null;
  }
  const score = winner.score / 100;
  const rivalScore = winner.rivalScore / 100;
  const distance = ranked.find((entry) => entry.key === winner.key)?.distance ?? 1;
  const unscoredRivals = failed.filter((key) => deps.artKeyOf(key) !== winner.artKey);
  const confident =
    unscoredRivals.length === 0 &&
    distance <= options.wideSearchDistance &&
    score - rivalScore >= options.confidentMargin;
  const alternatives = confident
    ? []
    : [
        ...new Map(
          [
            ...scores
              .filter(
                (entry) =>
                  deps.artKeyOf(entry.key) !== winner.artKey &&
                  entry.score >= score - options.alternativeBand,
              )
              .map((entry) => entry.key),
            ...unscoredRivals,
          ].map((key) => [deps.artKeyOf(key), key] as const),
        ).values(),
      ];
  const rotation = ranked.find((entry) => entry.key === winner.key)?.rotation ?? 0;
  const printing = confident
    ? await readPrinting(readPrintingOf, winner, crop, rotation, deps)
    : null;
  return {
    key: printing ?? winner.key,
    artKey: winner.artKey,
    quad,
    score,
    rivalScore,
    distance,
    confident,
    alternatives,
    printingResolved: printing !== null,
  };
}

// An outline that fails to identify must not hide the outlines it overlaps.
export async function identifyBoard(
  photo: RgbaImage,
  outlines: readonly CardCandidate[],
  deps: BoardDeps,
  options: BoardOptions,
): Promise<BoardCard[]> {
  const verify = createAlignedVerifier(deps.fetchReference);
  const { identityOf } = deps;
  const readPrintingOf = identityOf ? createPrintingReader({ ...deps, identityOf }) : null;
  const cards: BoardCard[] = [];
  for (const outline of outlines.toSorted((a, b) => b.score - a.score)) {
    if (cards.some((card) => samePosition(outline.quad, card.quad))) {
      continue;
    }
    const card = await identifyOutline(photo, outline.quad, verify, readPrintingOf, deps, options);
    if (card) {
      cards.push(card);
    }
  }
  return distinctWholeOutlines(cards);
}

/** Pixels on the long side. */
const BOARD_DETECT_SIDE = 1600;
export const BOARD_TILE = 800;

export function shrinkPhoto(photo: RgbaImage, side: number): { image: RgbaImage; factor: number } {
  const factor = Math.max(1, Math.max(photo.width, photo.height) / side);
  if (factor === 1) {
    return { image: photo, factor };
  }
  const width = Math.round(photo.width / factor);
  const height = Math.round(photo.height / factor);
  const whole: Quad = [
    { x: 0, y: 0 },
    { x: photo.width, y: 0 },
    { x: photo.width, y: photo.height },
    { x: 0, y: photo.height },
  ];
  const image = unwarpQuad(photo, whole, width, height);
  return image ? { image, factor: photo.width / width } : { image: photo, factor: 1 };
}

export async function detectTiled(
  image: RgbaImage,
  detect: (image: RgbaImage) => Promise<CardCandidate[]>,
  tile = BOARD_TILE,
): Promise<CardCandidate[]> {
  const tiles: { tile: BoardTile; candidates: CardCandidate[] }[] = [];
  for (const area of boardTiles(image.width, image.height, tile)) {
    tiles.push({ tile: area, candidates: await detect(cropImage(image, area)) });
  }
  tiles.push({
    tile: { x: 0, y: 0, width: image.width, height: image.height },
    candidates: await detect(image),
  });
  return outlinesFromTiles(image, tiles);
}

export async function detectOutlinesInPhoto(
  photo: RgbaImage,
  detect: (image: RgbaImage) => Promise<CardCandidate[]>,
  maxSide = BOARD_DETECT_SIDE,
): Promise<CardCandidate[]> {
  const { image: small, factor } = shrinkPhoto(photo, maxSide);
  const detected = await detectTiled(small, detect);
  return detected.map((outline) => ({
    ...outline,
    quad: mapQuad(outline.quad, (point) => ({ x: point.x * factor, y: point.y * factor })),
  }));
}

export async function readBoard(
  photo: RgbaImage,
  detect: (image: RgbaImage) => Promise<CardCandidate[]>,
  deps: BoardDeps,
  options: BoardOptions,
): Promise<BoardCard[]> {
  return await identifyBoard(photo, await detectOutlinesInPhoto(photo, detect), deps, options);
}
