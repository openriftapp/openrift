import type { CopyResponse } from "@openrift/shared/types/api/collection";
import type { Collection } from "@tanstack/react-db";
import { useQueryClient } from "@tanstack/react-query";

import { getCopiesCollection } from "@/features/collections/lib/copies-collection";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSession } from "@/hooks/use-session";

/** Null until hydrated: a collection built during SSR starts syncing, and one holding rows mismatches the HTML. */
export function useCopiesCollection(): Collection<CopyResponse, string | number> | null {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const hydrated = useHydrated();
  const userId = session?.user?.id ?? null;
  if (!hydrated || !userId) {
    return null;
  }
  return getCopiesCollection(queryClient, userId);
}
