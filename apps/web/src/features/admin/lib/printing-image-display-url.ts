import type { AdminPrintingImageResponse } from "@openrift/shared/types/api/admin";

export function printingImageDisplayUrl(img: AdminPrintingImageResponse): string | null {
  if (!img.rehostedUrl) {
    return img.originalUrl;
  }
  return `${img.rehostedUrl}-full.webp`;
}
