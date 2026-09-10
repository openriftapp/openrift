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
  "card-review": ["/admin/catalog"],
};

function underRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/**
 * card-review's manual-create pages (`.../create`) resolve to null on
 * purpose: the admin layout guard bounces grant holders off them.
 */
export function adminSectionForPathname(pathname: string): AdminSectionSlug | null {
  for (const slug of ADMIN_SECTION_SLUGS) {
    const route = ADMIN_SECTION_ROUTES[slug];
    const extra = EXTRA_SECTION_ROUTES[slug] ?? [];
    if (!underRoute(pathname, route) && !extra.some((r) => underRoute(pathname, r))) {
      continue;
    }
    if (slug === "card-review" && pathname.endsWith("/create")) {
      return null;
    }
    return slug;
  }
  return null;
}
