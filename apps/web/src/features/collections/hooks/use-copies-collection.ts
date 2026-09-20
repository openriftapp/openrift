import type { CopyResponse } from "@openrift/shared/types/api/collection";
import type { Collection } from "@tanstack/react-db";
import { useQueryClient } from "@tanstack/react-query";

import { getCopiesCollection } from "@/features/collections/lib/copies-collection";
import { useSession } from "@/lib/auth-session";

export function useCopiesCollection(): Collection<CopyResponse, string | number> | null {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user?.id ?? null;
  return userId ? getCopiesCollection(queryClient, userId) : null;
}
