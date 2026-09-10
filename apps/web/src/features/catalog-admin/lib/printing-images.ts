import { imageUrl } from "@openrift/shared/image-url";
import type {
  AdminPrintingImageResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";

import { imageQuadOf, quadCacheKey } from "@/features/admin/lib/straighten-quad";

export type PrintingImageVariant = "120w" | "240w" | "400w";

export function printingImagesOf(
  printingId: string,
  images: readonly AdminPrintingImageResponse[],
): AdminPrintingImageResponse[] {
  return images.filter((image) => image.printingId === printingId);
}

/** Substitute art fills the front slot only, so an active back-only scan still needs it. */
export function activeFrontImage(
  printingId: string,
  images: readonly AdminPrintingImageResponse[],
): AdminPrintingImageResponse | undefined {
  return images.find(
    (image) => image.printingId === printingId && image.isActive && image.face === "front",
  );
}

export function displayPrintingImage(
  printingId: string,
  images: readonly AdminPrintingImageResponse[],
): AdminPrintingImageResponse | undefined {
  const own = printingImagesOf(printingId, images).filter((image) => image.isActive);
  return own.find((image) => image.face === "front") ?? own.at(0);
}

/**
 * A rehosted file is rewritten in place on rotate, straighten and trim, so the
 * stable path carries the current state as a cache-buster.
 */
export function printingImageSrc(
  image: AdminPrintingImageResponse,
  variant: PrintingImageVariant,
): string | null {
  if (image.rehostedUrl === null) {
    return image.originalUrl;
  }
  const trim = image.needsTrim ? 1 : 0;
  const quad = quadCacheKey(imageQuadOf(image));
  return `${imageUrl(image.imageFileId, variant)}?r=${image.rotation}&t=${trim}&q=${quad}`;
}

export function printingImageFullSrc(image: AdminPrintingImageResponse): string | null {
  if (image.rehostedUrl === null) {
    return image.originalUrl;
  }
  const trim = image.needsTrim ? 1 : 0;
  const quad = quadCacheKey(imageQuadOf(image));
  return `${image.rehostedUrl}-full.webp?r=${image.rotation}&t=${trim}&q=${quad}`;
}

export interface SiblingArtOption {
  imageFileId: string;
  label: string;
}

/** One entry per underlying file: a scan shared across printings must not be offered twice. */
export function siblingArtOptions(
  printingId: string,
  printings: readonly AdminPrintingResponse[],
  images: readonly AdminPrintingImageResponse[],
): SiblingArtOption[] {
  const seen = new Set<string>();
  const out: SiblingArtOption[] = [];
  for (const image of images) {
    if (image.printingId === printingId || seen.has(image.imageFileId)) {
      continue;
    }
    seen.add(image.imageFileId);
    const owner = printings.find((printing) => printing.id === image.printingId);
    out.push({
      imageFileId: image.imageFileId,
      label: owner?.expectedPrintingId ?? image.printingId,
    });
  }
  return out;
}
