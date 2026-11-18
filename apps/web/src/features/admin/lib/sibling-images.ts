import type {
  AdminPrintingImageResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";

export interface SiblingImage {
  imageFileId: string;
  printingLabel: string;
  /** Active on another face of the card or pinned there as fallback art. */
  inUse: boolean;
}

/** One entry per image file of the card's other faces; the pin stores the file, not the row. */
export function siblingImagesOf(
  printingImages: readonly AdminPrintingImageResponse[],
  printings: readonly AdminPrintingResponse[],
  facePrintingIds: ReadonlySet<string>,
): SiblingImage[] {
  const pinned = new Set(
    printings.flatMap((printing) =>
      !facePrintingIds.has(printing.id) && printing.fallbackImageFileId !== null
        ? [printing.fallbackImageFileId]
        : [],
    ),
  );
  const byFile = new Map<string, SiblingImage>();
  for (const image of printingImages) {
    if (facePrintingIds.has(image.printingId)) {
      continue;
    }
    const known = byFile.get(image.imageFileId);
    if (known) {
      known.inUse ||= image.isActive;
      continue;
    }
    const owner = printings.find((printing) => printing.id === image.printingId);
    byFile.set(image.imageFileId, {
      imageFileId: image.imageFileId,
      printingLabel: owner?.expectedPrintingId ?? image.printingId,
      inUse: image.isActive || pinned.has(image.imageFileId),
    });
  }
  return [...byFile.values()];
}
