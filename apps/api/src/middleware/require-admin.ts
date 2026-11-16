import type { AdminSectionSlug } from "@openrift/shared/admin-sections";
import { isAdminSectionSlug } from "@openrift/shared/admin-sections";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import type { MiddlewareHandler } from "hono";

import type { Repos } from "../deps.js";
import { AppError, forbidden } from "../errors.js";
import type { Variables } from "../types.js";
import { resolveSession } from "./load-session.js";

export interface AdminAccess {
  isAdmin: boolean;
  sections: AdminSectionSlug[];
}

const ADMIN_CACHE_TTL = 30_000;
const accessCache = new Map<string, { access: AdminAccess; expiresAt: number }>();

/**
 * Caches positive results (any access at all) for 30 seconds; users with no
 * access are re-checked every request.
 */
export async function getAdminAccess(repos: Repos, userId: string): Promise<AdminAccess> {
  const cached = accessCache.get(userId);
  if (cached !== undefined && Date.now() < cached.expiresAt) {
    return cached.access;
  }

  const isAdmin = await repos.admins.isAdmin(userId);
  const grantedSections = isAdmin ? [] : await repos.adminGrants.sectionsForUser(userId);
  const sections = grantedSections.filter((section) => isAdminSectionSlug(section));
  const access: AdminAccess = { isAdmin, sections };

  if (isAdmin || sections.length > 0) {
    accessCache.set(userId, { access, expiresAt: Date.now() + ADMIN_CACHE_TTL });
  } else {
    accessCache.delete(userId);
  }
  return access;
}

// Grant holders with no matching section still need to reach this probe to
// learn which sections they hold; users with no access get 403 from it too.
const ME_PATH = "/api/admin/v1/me";

/** The sections a route opens to grant holders, from its contract's `adminSections` meta; none means admin-only. */
export function adminSectionsOf(
  meta: Readonly<Record<string, unknown>> | undefined,
): AdminSectionSlug[] {
  const sections = meta?.adminSections;
  return Array.isArray(sections)
    ? sections.filter(
        (section): section is AdminSectionSlug =>
          typeof section === "string" && isAdminSectionSlug(section),
      )
    : [];
}

export type AdminSectionsResolver = (
  method: string,
  path: string,
) => Promise<readonly AdminSectionSlug[]>;

/** Reads the sections from the meta of the procedure a request resolves to. */
export function sectionsFromRoute(
  resolveRoute: (
    method: string,
    path: string,
  ) => Promise<{ meta: Readonly<Record<string, unknown>> } | undefined>,
): AdminSectionsResolver {
  return async (method, path) => {
    const route = await resolveRoute(method, path);
    return adminSectionsOf(route?.meta);
  };
}

/** HEAD resolves as GET, the way the API handler runs it. */
export function requireAdmin(
  sectionsFor: AdminSectionsResolver,
): MiddlewareHandler<{ Variables: Variables }> {
  return async (c, next) => {
    await resolveSession(c);
    const user = c.get("user");
    if (!user) {
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED, "Unauthorized");
    }

    const access = await getAdminAccess(c.get("repos"), user.id);
    // adminAccess is read downstream (card-review's candidate allowlist); do not remove as unused.
    c.set("adminAccess", access);
    if (!access.isAdmin) {
      const path = c.req.path;
      const method = c.req.method === "HEAD" ? "GET" : c.req.method;
      const routeSections =
        access.sections.length > 0 && path !== ME_PATH ? await sectionsFor(method, path) : [];
      const allowed =
        access.sections.length > 0 &&
        (path === ME_PATH || routeSections.some((section) => access.sections.includes(section)));
      if (!allowed) {
        throw forbidden("Forbidden");
      }
    }

    await next();
  };
}

/** For a Hono route outside oRPC, which declares its sections where it is mounted. */
export function requireAdminSections(
  ...sections: AdminSectionSlug[]
): MiddlewareHandler<{ Variables: Variables }> {
  return requireAdmin(() => Promise.resolve(sections));
}
