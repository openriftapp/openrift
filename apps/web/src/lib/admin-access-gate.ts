import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import { adminAccessQueryOptions } from "@/features/admin/lib/admin-queries";
import {
  ADMIN_SECTION_ROUTES,
  adminSectionsForPathname,
} from "@/features/admin/lib/admin-sections";

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export async function requireAdminAccess({
  context,
  location,
}: {
  context: { queryClient: QueryClient; userId: string };
  location: { pathname: string };
}): Promise<void> {
  const access = await context.queryClient.query({
    ...adminAccessQueryOptions(context.userId),
    staleTime: "static",
  });
  if (access.isAdmin) {
    return;
  }
  const firstGranted = access.sections.at(0);
  if (firstGranted === undefined) {
    throw redirect({ to: "/cards" });
  }
  const sections = adminSectionsForPathname(location.pathname);
  if (!access.sections.some((s) => sections.includes(s))) {
    throw redirect({ to: ADMIN_SECTION_ROUTES[firstGranted] });
  }
}
