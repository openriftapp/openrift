import type { ImageQuad } from "@openrift/shared/contracts/admin/card-images";
import type { ImageVariant } from "@openrift/shared/image-url";

import { quadCacheKey } from "@/features/admin/lib/straighten-quad";

const REHOSTED_PREFIX = "/media/cards/";

/** Rehosted URLs are stable while the files behind them are rewritten in place on rotate and straighten. */
export function deskImageBust(image: { rotation: number; quad: ImageQuad | null }): string {
  return `r=${image.rotation}&q=${quadCacheKey(image.quad)}`;
}

/** Rehosted URLs are stored without the variant suffix; source URLs are served as they are. */
export function deskImageSrc(
  url: string | null,
  variant: ImageVariant,
  bust?: string,
): string | null {
  if (url === null) {
    return null;
  }
  if (!url.startsWith(REHOSTED_PREFIX)) {
    return url;
  }
  return `${url}-${variant}.webp${bust === undefined ? "" : `?${bust}`}`;
}
