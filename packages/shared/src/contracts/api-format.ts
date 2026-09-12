// Cacheable responses can outlive a deploy in the browser HTTP cache, so a client
// may parse a body shaped by a different release than the one it was built against.
// Bump this (+1) in the same commit as any cacheable-contract response shape change
// that old and new parsing code cannot both handle. Purely additive fields don't need a bump.
export const API_FORMAT_VERSION = 1;

/** Response header carrying {@link API_FORMAT_VERSION} on cacheable API responses. */
export const API_FORMAT_HEADER = "X-Api-Format";

/** Response header carrying the server's build id, on responses no cache may reuse. */
export const BUILD_ID_HEADER = "X-Build-Id";

/**
 * Whether a response with this `Cache-Control` may carry {@link BUILD_ID_HEADER}:
 * a replayed cached body would present a stale build id as the server's current one.
 */
export function isBuildIdSafe(cacheControl: string | null): boolean {
  return cacheControl === null || /\bno-store\b/iu.test(cacheControl);
}
