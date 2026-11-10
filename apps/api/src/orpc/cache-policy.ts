// Cache-Control policy for public oRPC reads, derived from contract `.meta()`
// (`cache`, `etag`, `cacheVary`) so there is no second route table to maintain.
// The header itself is resolved per request in `cache-control-interceptor.ts`;
// `ETAG_PATHS`, `VIEWER_VARYING_PATHS` and `DEVELOPER_API_PATHS` are walked out of the
// contracts up front for Hono middleware registered before oRPC runs.

import type { Context, Next } from "hono";

import { collectContractRoutes } from "../lib/contract-routes.js";

type CacheLevel = "long" | "medium" | "short" | "sitemap" | "revalidate";

export interface CacheMeta {
  cache?: CacheLevel;
  cacheVary?: "viewer";
  etag?: boolean;
}

const CACHE_HEADERS: Record<CacheLevel, string> = {
  long: "public, max-age=3600, stale-while-revalidate=86400",
  sitemap: "public, max-age=3600, stale-while-revalidate=7200",
  medium: "public, max-age=300, stale-while-revalidate=600",
  short: "public, max-age=60, stale-while-revalidate=300",
  revalidate: "private, no-cache",
};

type RouteMeta = CacheMeta & { developerApi?: boolean };

function collectGetPaths(include: (meta: RouteMeta) => boolean): string[] {
  return collectContractRoutes()
    .filter(({ method, meta }) => method === "GET" && include(meta as RouteMeta))
    .map(({ path }) => path);
}

function toHonoPath(path: string): string {
  return path.replaceAll(/\{(?<param>[^}]+)\}/gu, ":$<param>");
}

/** Etag'd GET paths in Hono `:param` form, e.g. `/api/v1/cards/:cardSlug`. */
export const ETAG_PATHS: string[] = collectGetPaths((meta) => meta.etag === true).map((path) =>
  toHonoPath(path),
);

/** In Hono `:param` form. */
export const VIEWER_VARYING_PATHS: string[] = collectGetPaths(
  (meta) => meta.cacheVary === "viewer",
).map((path) => toHonoPath(path));

export const DEVELOPER_API_PATHS: string[] = collectGetPaths((meta) => meta.developerApi === true);

// Must run outside etag() so the ETag header exists yet.
export async function immutableWhenVersionMatches(c: Context, next: Next): Promise<void> {
  await next();
  const version = c.req.query("v");
  if (!version) {
    return;
  }
  const etagHeader = c.res.headers.get("ETag");
  const cacheControl = c.res.headers.get("Cache-Control");
  if (!etagHeader || !cacheControl?.startsWith("public")) {
    return;
  }
  const bareTag = etagHeader.replace(/^W\//u, "").replaceAll('"', "");
  if (bareTag === version) {
    c.res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }
}

/** `hasUser` selects the private/public variant; `loadSession` already set `Vary: Cookie`. */
export function resolveCacheControl(meta: CacheMeta, hasUser: boolean): string | undefined {
  if (!meta.cache) {
    return undefined;
  }
  const header = CACHE_HEADERS[meta.cache];
  return meta.cacheVary === "viewer" && hasUser ? header.replace("public,", "private,") : header;
}
