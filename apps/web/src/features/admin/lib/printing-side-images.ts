import type { CardFace } from "@openrift/shared/types/enums";

/** The images of the side `printing` is shown from: a double-sided printing has images per side. */
export function imagesOnSide<T extends { printingId: string; face: CardFace }>(
  images: readonly T[],
  printing: { id: string; side: 1 | 2 },
): T[] {
  const face: CardFace = printing.side === 2 ? "back" : "front";
  return images.filter((image) => image.printingId === printing.id && image.face === face);
}
