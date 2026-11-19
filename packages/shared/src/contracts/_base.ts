import { oc } from "@orpc/contract";

import type { ApiKeyScope } from "../api-key-scopes.js";

/**
 * oRPC only upgrades a thrown `AppError` to a typed error when its code is
 * declared here AND its status matches oRPC's default for that code.
 * `VALIDATION_ERROR` has no oRPC default, so any contract declaring it must
 * pin `{ status: 422 }` or the upgrade silently no-ops. `INTERNAL_ERROR` is
 * deliberately never declared: a server fault stays an undefined `ORPCError`.
 */

/** Base builder for session-gated procedures; add domain codes per route. */
export const authedRoute = oc.errors({
  UNAUTHORIZED: { message: "Unauthorized" },
  FORBIDDEN: { message: "Forbidden" },
});

/** Key management: refused to every API key, admin-scoped ones included. */
export const keyManagementRoute = authedRoute.meta({ keyManagement: true });

/**
 * Opens a session-gated procedure to API keys holding `scope`; a procedure without it refuses keys.
 * `documented` lists it in the developer spec, which needs an operationId, summary and description.
 */
export function apiKeyScope(
  scope: ApiKeyScope,
  options?: { documented: true },
): { apiKeyScope: ApiKeyScope; apiKeyDocumented?: true } {
  return options?.documented
    ? { apiKeyScope: scope, apiKeyDocumented: true }
    : { apiKeyScope: scope };
}
