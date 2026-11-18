import type { ImageVariant } from "@openrift/shared/image-url";

const REHOSTED_PREFIX = "/media/cards/";

/** Rehosted URLs are stored without the variant suffix; source URLs are served as they are. */
export function deskImageSrc(url: string | null, variant: ImageVariant): string | null {
  if (url === null) {
    return null;
  }
  if (!url.startsWith(REHOSTED_PREFIX)) {
    return url;
  }
  return `${url}-${variant}.webp`;
}
