import type { Context } from "hono";

/** `x-real-ip` is trustworthy because nginx overwrites it from the connection
 * address (see docs/deployment.md). */
export function clientAddress(c: Context): string {
  return c.req.header("x-real-ip") ?? "unknown";
}
