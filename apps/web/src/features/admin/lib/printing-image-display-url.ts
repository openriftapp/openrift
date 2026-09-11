import type { AdminPrintingImageResponse } from "@openrift/shared/types/api/admin";

import { imageQuadOf, quadCacheKey } from "@/features/admin/lib/straighten-quad";

export function printingImageDisplayUrl(img: AdminPrintingImageResponse): string | null {
  if (!img.rehostedUrl) {
    return img.originalUrl;
  }
  // Cache-bust: the rehosted URL is stable, but the file is rewritten in place
  // on straighten/rotation/trim.
  return `${img.rehostedUrl}-full.webp?r=${img.rotation}&t=${img.needsTrim ? 1 : 0}&q=${quadCacheKey(imageQuadOf(img))}`;
}
