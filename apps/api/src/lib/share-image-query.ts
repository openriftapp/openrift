import type { ShareImageAspect } from "@openrift/shared/share-image-params";
import { aspectFromQuery, qrFromQuery, scaleFromQuery } from "@openrift/shared/share-image-params";

export interface ParsedShareImageQuery {
  scale: number;
  aspect: ShareImageAspect;
  qr: boolean;
}

/**
 * Pass Hono's `c.req.query`; `?size=hq` is the older spelling of `?scale=2`.
 * Public token URLs read only `size=hq`, so they keep one cache entry per variant.
 */
export function parseShareImageQuery(
  query: (name: string) => string | undefined,
  access: "owner" | "public" = "owner",
): ParsedShareImageQuery {
  return {
    scale:
      access === "public"
        ? scaleFromQuery(undefined, query("size"))
        : scaleFromQuery(query("scale"), query("size")),
    aspect: aspectFromQuery(query("aspect")),
    qr: qrFromQuery(query("qr")),
  };
}
