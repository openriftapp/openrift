import type { Context, Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";

import { resolveSession } from "../../../middleware/load-session.js";
import { orpcErrorResponse } from "../../../orpc/error-body.js";
import type { Variables } from "../../../types.js";

export const BOARD_STATE_CREATES_PER_HOUR = 30;
export const BOARD_STATE_SHARES_PER_HOUR = 20;

type Ctx = Context<{ Variables: Variables }>;

function perUserHourlyLimit(limit: number, message: string) {
  return rateLimiter<{ Variables: Variables }>({
    windowMs: 60 * 60_000,
    limit,
    standardHeaders: "draft-6",
    // Signed-out requests pass through so the router answers them with its own 401.
    skip: async (c: Ctx) => {
      if (c.req.method !== "POST") {
        return true;
      }
      await resolveSession(c);
      return !c.get("user");
    },
    keyGenerator: (c: Ctx) => c.get("user")?.id ?? "anonymous",
    handler: (c: Ctx) => orpcErrorResponse(c, "TOO_MANY_REQUESTS", message),
  });
}

/** In-memory, per API process. Must be registered before the oRPC catch-all. */
export function mountBoardStatesRateLimit(app: Hono<{ Variables: Variables }>): void {
  app.use(
    "/api/v1/board-states",
    perUserHourlyLimit(
      BOARD_STATE_CREATES_PER_HOUR,
      `You can create up to ${BOARD_STATE_CREATES_PER_HOUR} board states per hour. Please try again later.`,
    ),
  );
  app.use(
    "/api/v1/board-states/:id/share",
    perUserHourlyLimit(
      BOARD_STATE_SHARES_PER_HOUR,
      `You can create up to ${BOARD_STATE_SHARES_PER_HOUR} share links per hour. Please try again later.`,
    ),
  );
}
