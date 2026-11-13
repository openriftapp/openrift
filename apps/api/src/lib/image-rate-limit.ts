import { ERROR_CODES } from "@openrift/shared/error-codes";
import type { Context, MiddlewareHandler } from "hono";
import { rateLimiter } from "hono-rate-limiter";

import type { Variables } from "../types.js";
import { clientAddress } from "./client-address.js";
import { jsonError } from "./http-response.js";

type Ctx = Context<{ Variables: Variables }>;

/** `user` keys by the signed-in user, so it must run after `requireAuth`. */
export function imageRateLimit(
  perMinute: number,
  key: "ip" | "user",
): MiddlewareHandler<{ Variables: Variables }> {
  return rateLimiter<{ Variables: Variables }>({
    windowMs: 60_000,
    limit: perMinute,
    standardHeaders: "draft-6",
    keyGenerator: (c: Ctx) =>
      key === "user" ? (c.get("user")?.id ?? clientAddress(c)) : clientAddress(c),
    handler: (c: Ctx) =>
      jsonError(
        c,
        429,
        "Too many image requests. Try again in a minute.",
        ERROR_CODES.RATE_LIMITED,
      ),
  });
}

const OWNER_IMAGE_RENDERS_PER_MINUTE = 30;

export const ownerImageRateLimit = imageRateLimit(OWNER_IMAGE_RENDERS_PER_MINUTE, "user");
