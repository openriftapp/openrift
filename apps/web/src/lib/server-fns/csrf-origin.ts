import { getSiteUrl } from "@/lib/site-config";

/**
 * Behind the proxy `request.url` is `http://`, so a same-site `https://` Origin
 * or Referer never matches it; the public site origin is accepted too.
 */
export function isTrustedServerFnOrigin(origin: string, request: Request): boolean {
  return origin === new URL(request.url).origin || origin === new URL(getSiteUrl()).origin;
}
