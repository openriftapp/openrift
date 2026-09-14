import { useQuery } from "@tanstack/react-query";

import { adminAccessQueryOptions } from "@/features/admin/lib/admin-queries";
import { useUserId } from "@/lib/auth-session";

export function useAdminAccess() {
  const userId = useUserId();
  return useQuery(adminAccessQueryOptions(userId));
}

export function useIsAdmin() {
  const userId = useUserId();
  return useQuery({ ...adminAccessQueryOptions(userId), select: (data) => data.isAdmin });
}
