import type { Context } from "hono";

/** oRPC matches the still-encoded pathname, while Hono's `c.req.path` is decoded; resolve routes from this one. */
export function rawPathname(c: Context): string {
  return new URL(c.req.url).pathname;
}
