/**
 * Pick by slot CSS width × DPR: `120w` covers up to ~60px at DPR 2, `240w` up
 * to ~120px, `400w` up to ~200px; `full` is the 800w hero size.
 */
export type ImageVariant = "120w" | "240w" | "400w" | "full";

/** The public form; nginx and the dev server map it onto the sharded on-disk layout (see `imageShardDir`). */
export function imageUrl(imageId: string, variant: ImageVariant): string {
  return `/media/cards/${imageId}-${variant}.webp`;
}

/** Directory prefix under `media/cards/`: the id's last 2 hex chars, matching the rehoster's on-disk layout. */
export function imageShardDir(imageId: string): string {
  return imageId.slice(-2);
}
