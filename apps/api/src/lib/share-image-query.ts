import type { ShareImageAspect } from "@openrift/shared/share-image-params";
import { aspectFromQuery, qrFromQuery, scaleFromQuery } from "@openrift/shared/share-image-params";

export interface ParsedShareImageQuery {
  scale: number;
  aspect: ShareImageAspect;
  qr: boolean;
}

/** Pass Hono's `c.req.query`; `?size=hq` is the older spelling of `?scale=2`. */
export function parseShareImageQuery(
  query: (name: string) => string | undefined,
): ParsedShareImageQuery {
  return {
    scale: scaleFromQuery(query("scale"), query("size")),
    aspect: aspectFromQuery(query("aspect")),
    qr: qrFromQuery(query("qr")),
  };
}
