import { useSuspenseQuery } from "@tanstack/react-query";

import { adminUsersQueryOptions } from "@/features/admin/lib/admin-users-queries";

export function useAdminUsers() {
  return useSuspenseQuery(adminUsersQueryOptions);
}
