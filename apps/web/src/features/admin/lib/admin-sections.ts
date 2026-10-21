import type { AdminSectionSlug } from "@openrift/shared/admin-sections";
import { ADMIN_SECTION_SLUGS } from "@openrift/shared/admin-sections";

export const ADMIN_SECTION_ROUTES = {
  "card-review": "/admin/cards",
  "card-tags": "/admin/card-tags",
  "custom-tags": "/admin/custom-tags",
  "printing-desk": "/admin/printing-desk",
  products: "/admin/products",
} as const satisfies Record<AdminSectionSlug, `/admin/${string}`>;

const EXTRA_SECTION_ROUTES: Partial<Record<AdminSectionSlug, readonly `/admin/${string}`[]>> = {
  "card-review": ["/admin/review", "/admin/workspace"],
  "printing-desk": ["/admin/printings", "/admin/workspace/printings"],
};

const WORKSPACE_ROOT = "/admin/workspace";
const WORKSPACE_FACE_RECORD = /^\/admin\/workspace\/faces\/[^/]+\/[^/]+\/?$/u;

function underRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function sectionCovers(slug: AdminSectionSlug, pathname: string): boolean {
  const extra = EXTRA_SECTION_ROUTES[slug] ?? [];
  if (
    underRoute(pathname, ADMIN_SECTION_ROUTES[slug]) ||
    extra.some((r) => underRoute(pathname, r))
  ) {
    return true;
  }
  return (
    slug === "printing-desk" &&
    (pathname === WORKSPACE_ROOT ||
      pathname === `${WORKSPACE_ROOT}/` ||
      WORKSPACE_FACE_RECORD.test(pathname))
  );
}

/**
 * card-review's manual-create pages (`.../create`) are left out on purpose:
 * the admin layout guard bounces card-review holders off them.
 */
export function adminSectionsForPathname(pathname: string): AdminSectionSlug[] {
  return ADMIN_SECTION_SLUGS.filter(
    (slug) =>
      sectionCovers(slug, pathname) && !(slug === "card-review" && pathname.endsWith("/create")),
  );
}
