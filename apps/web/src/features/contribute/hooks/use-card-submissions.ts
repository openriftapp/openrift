import { useInfiniteQuery } from "@tanstack/react-query";

import { cardSubmissionsQueryOptions } from "@/features/contribute/lib/card-submissions-queries";
import { useRequiredUserId } from "@/lib/auth-session";

export function useCardSubmissions() {
  const userId = useRequiredUserId();
  return useInfiniteQuery(cardSubmissionsQueryOptions(userId));
}
