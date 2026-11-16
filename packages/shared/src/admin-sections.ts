/**
 * A section opens an admin procedure through `.meta({ adminSections: [...] })` on its
 * contract; a procedure without one is admin-only. A new section also needs
 * `ADMIN_SECTION_ROUTES` in `apps/web/src/lib/admin-sections.ts`, which fails closed.
 */
export const ADMIN_SECTION_SLUGS = [
  "card-review",
  "card-tags",
  "custom-tags",
  "printing-desk",
  "products",
] as const;

export type AdminSectionSlug = (typeof ADMIN_SECTION_SLUGS)[number];

export const ADMIN_SECTION_LABELS: Record<AdminSectionSlug, string> = {
  "card-review": "Card Review",
  "card-tags": "Card Tags",
  "custom-tags": "Custom Tags",
  "printing-desk": "Printing Desk",
  products: "Products",
};

export function isAdminSectionSlug(value: string): value is AdminSectionSlug {
  return (ADMIN_SECTION_SLUGS as readonly string[]).includes(value);
}
