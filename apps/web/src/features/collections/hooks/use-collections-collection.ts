import { useQueryClient } from "@tanstack/react-query";

import { getCollectionsCollection } from "@/features/collections/lib/collections-collection";
import type { CollectionsCollection } from "@/features/collections/lib/collections-write";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSession } from "@/hooks/use-session";

export function useCollectionsCollection(): CollectionsCollection | null {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const hydrated = useHydrated();
  const userId = session?.user?.id ?? null;
  return hydrated && userId ? getCollectionsCollection(queryClient, userId) : null;
}
