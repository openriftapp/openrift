import { useQuery } from "@tanstack/react-query";

import { sourcesQueryOptions } from "@/features/admin/lib/sources-queries";

export function useSources() {
  return useQuery(sourcesQueryOptions);
}
