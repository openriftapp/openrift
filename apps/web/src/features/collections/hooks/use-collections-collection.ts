import { useQueryClient } from "@tanstack/react-query";

import { getCollectionsCollection } from "@/features/collections/lib/collections-collection";
import type { CollectionsCollection } from "@/features/collections/lib/collections-write";
import { useSession } from "@/lib/auth-session";

export function useCollectionsCollection(): CollectionsCollection | null {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user?.id ?? null;
  return userId ? getCollectionsCollection(queryClient, userId) : null;
}
