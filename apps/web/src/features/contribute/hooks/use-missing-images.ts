import { useQuery } from "@tanstack/react-query";

import { missingImagesQueryOptions } from "@/features/contribute/lib/card-submissions-queries";
import { useUserId } from "@/hooks/use-session";

export function useMyMissingImages() {
  const userId = useUserId();
  return useQuery(missingImagesQueryOptions(userId));
}
