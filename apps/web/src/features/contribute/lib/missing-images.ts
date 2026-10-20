import type { MissingImagePrinting } from "@openrift/shared/contracts/card-submissions";

export function otherMissingImages(
  items: readonly MissingImagePrinting[],
  current: { printingId: string; cardSlug: string },
): MissingImagePrinting[] {
  return items.filter(
    (item) => item.printingId !== current.printingId || item.cardSlug !== current.cardSlug,
  );
}
