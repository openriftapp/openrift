import {
  apiKeyHoldsScope,
  isApiKeyScope,
  parseApiKeyPermissions,
} from "@openrift/shared/api-key-scopes";
import { isAPIError } from "better-auth/api";
import type { Context, MiddlewareHandler } from "hono";

import { ADMIN_API_PREFIX } from "../lib/admin-api-prefix.js";
import { rawPathname } from "../lib/raw-pathname.js";
import { mapAuthError } from "../modules/users/lib/better-auth-error.js";
import { orpcErrorResponse } from "../orpc/error-body.js";
import type { ApiRouteResolver } from "../orpc/router.js";
import type { Variables } from "../types.js";
import { resolveSession } from "./load-session.js";
import { getAdminAccess } from "./require-admin.js";

const API_KEY_HEADER = "x-api-key";

function refuse(c: Context, message: string): Response {
  return orpcErrorResponse(c, "FORBIDDEN", message);
}

/** A 5xx stays a thrown error so `onError` reports it; key denials answer in the oRPC error shape. */
async function resolveKeySession(c: Context<{ Variables: Variables }>): Promise<Response | null> {
  try {
    await resolveSession(c);
    return null;
  } catch (error) {
    if (!isAPIError(error) || error.statusCode >= 500) {
      throw error;
    }
    const { status, code, message, retryAfterSeconds } = mapAuthError(error);
    const response = orpcErrorResponse(c, code, message, status);
    if (retryAfterSeconds !== undefined) {
      response.headers.set("Retry-After", String(retryAfterSeconds));
    }
    return response;
  }
}

/**
 * Must run before every other `/api` handler, `/api/auth/*` included: better-auth
 * turns a key into a full session on all of its own endpoints.
 */
export function apiKeyGate(resolveRoute: ApiRouteResolver): MiddlewareHandler<{
  Variables: Variables;
}> {
  return async (c, next) => {
    if (!c.req.header(API_KEY_HEADER)) {
      await next();
      return;
    }
    const path = c.req.path;
    if (path.startsWith("/api/auth/")) {
      return refuse(c, "API keys cannot call account endpoints");
    }

    const isAdminPath = path.startsWith(`${ADMIN_API_PREFIX}/`);
    const method = c.req.method === "HEAD" ? "GET" : c.req.method;
    const route = isAdminPath ? undefined : await resolveRoute(method, rawPathname(c));
    const auth = route?.meta.auth;
    if (!isAdminPath && (route === undefined || auth === "public" || auth === "bearer")) {
      c.set("user", null);
      c.set("session", null);
      await next();
      return;
    }

    const denied = await resolveKeySession(c);
    if (denied) {
      return denied;
    }
    const user = c.get("user");
    const session = c.get("session");
    if (!user || !session) {
      await next();
      return;
    }

    if (route?.meta.keyManagement === true) {
      return refuse(c, "API keys cannot manage API keys");
    }

    const repos = c.get("repos");
    const permissions = parseApiKeyPermissions(await repos.apiKeys.permissionsById(session.id));
    if (permissions.admin) {
      const access = await getAdminAccess(repos, user.id);
      if (isAdminPath || access.isAdmin || access.sections.length > 0) {
        await next();
        return;
      }
    }

    const scope = route?.meta.apiKeyScope;
    if (isApiKeyScope(scope) && apiKeyHoldsScope(permissions, scope)) {
      c.set("apiKeyLimited", true);
      await next();
      return;
    }
    return refuse(c, "This API key does not allow this request");
  };
}
