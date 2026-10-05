/**
 * Where each counted card lies on the table during a sweep. Frame shifts
 * keep positions in table coordinates, so a card the camera returns to is
 * found again, while a copy of the same card elsewhere is a new place.
 */
import { quadCenter, touchesFrameEdge } from "./geometry";
import type { Quad } from "./types";

export interface TablePlace {
  key: string;
  x: number;
  y: number;
  size: number;
}

export interface TablePlaces {
  offsetX: number;
  offsetY: number;
  byArt: Map<string, TablePlace[]>;
}

/** Fraction of a card's diagonal. */
const SAME_PLACE = 0.45;
/** Frame pixels. */
const EDGE_MARGIN = 4;

export function createTablePlaces(): TablePlaces {
  return { offsetX: 0, offsetY: 0, byArt: new Map() };
}

export function shiftTable(places: TablePlaces, shift: { x: number; y: number }): void {
  places.offsetX -= shift.x;
  places.offsetY -= shift.y;
}

export function placeFor(
  places: TablePlaces,
  artKey: string,
  quad: Quad,
  frame: { width: number; height: number },
): TablePlace | null {
  const center = quadCenter(quad);
  const x = center.x + places.offsetX;
  const y = center.y + places.offsetY;
  const size =
    (Math.hypot(quad[2].x - quad[0].x, quad[2].y - quad[0].y) +
      Math.hypot(quad[3].x - quad[1].x, quad[3].y - quad[1].y)) /
    2;
  const known = places.byArt.get(artKey) ?? [];
  let nearest: { place: TablePlace; distance: number } | null = null;
  for (const place of known) {
    const distance = Math.hypot(x - place.x, y - place.y);
    if (!nearest || distance < nearest.distance) {
      nearest = { place, distance };
    }
  }
  const whole = !touchesFrameEdge(quad, frame.width, frame.height, EDGE_MARGIN);
  if (nearest && (nearest.distance <= Math.max(size, nearest.place.size) * SAME_PLACE || !whole)) {
    if (whole) {
      Object.assign(nearest.place, { x, y, size });
    }
    return nearest.place;
  }
  if (!whole) {
    return null;
  }
  const place = { key: `${artKey}#${known.length}`, x, y, size };
  places.byArt.set(artKey, [...known, place]);
  return place;
}

/** Whether the outline lies on a place already counted, whatever its artwork. */
export function onCountedPlace(
  places: TablePlaces,
  counted: ReadonlySet<string>,
  quad: Quad,
): boolean {
  const center = quadCenter(quad);
  const x = center.x + places.offsetX;
  const y = center.y + places.offsetY;
  for (const known of places.byArt.values()) {
    for (const place of known) {
      if (
        counted.has(place.key) &&
        Math.hypot(x - place.x, y - place.y) <= place.size * SAME_PLACE
      ) {
        return true;
      }
    }
  }
  return false;
}
