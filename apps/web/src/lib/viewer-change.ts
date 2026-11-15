import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { sessionQueryOptions } from "./auth-session";
import { featureFlagsQueryOptions } from "./feature-flags";

/** Route guards read flags with `staleTime: "static"`, which ignores invalidation, so this fetches. */
async function refetchFeatureFlags(queryClient: QueryClient): Promise<void> {
  try {
    await queryClient.query({ ...featureFlagsQueryOptions, staleTime: 0 });
  } catch {
    // Keeps the previous flags; a failed flag fetch must not block the auth flow.
  }
}

function sessionUserId(queryClient: QueryClient): string | undefined {
  return queryClient.getQueryData(sessionQueryOptions().queryKey)?.user.id;
}

/** Sign-in, account switch or an expired session; an expired one keeps the mounted page's queries. */
export async function refreshViewer(queryClient: QueryClient): Promise<void> {
  const previousUserId = sessionUserId(queryClient);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: sessionQueryOptions().queryKey }),
    refetchFeatureFlags(queryClient),
  ]);
  const userId = sessionUserId(queryClient);
  if (userId !== undefined && userId !== previousUserId) {
    clearViewerQueries(queryClient, previousUserId);
  }
}

const VIEWER_DEPENDENT_FAMILIES: ReadonlySet<unknown> = new Set([
  "admin",
  "auth",
  "card-submissions",
  "friend-groups",
  "meta-pending-submissions",
  "share-text",
  "tournament-decks",
  "tournaments",
  "user-share",
]);

const COLLECTION_STORE_SLOTS: ReadonlySet<unknown> = new Set(["store", "cards-store"]);

export function isSignedOutViewerQuery(queryKey: QueryKey, userId: string | undefined): boolean {
  // A TanStack DB collection owns this slot and frees it once its subscribers detach.
  if (userId !== undefined && queryKey[1] === userId && COLLECTION_STORE_SLOTS.has(queryKey[2])) {
    return false;
  }
  if (VIEWER_DEPENDENT_FAMILIES.has(queryKey[0])) {
    return true;
  }
  return userId !== undefined && queryKey.includes(userId);
}

/**
 * After a sign-out or account deletion. `leave` navigates away first: authenticated
 * components still mounted when the session flips to null throw in useRequiredUserId.
 */
export async function refreshViewerAfterSignOut(
  queryClient: QueryClient,
  leave: () => Promise<unknown>,
): Promise<void> {
  const userId = sessionUserId(queryClient);
  await refetchFeatureFlags(queryClient);
  await leave();
  await queryClient.invalidateQueries({ queryKey: sessionQueryOptions().queryKey });
  clearViewerQueries(queryClient, userId);
}

function clearViewerQueries(queryClient: QueryClient, previousUserId: string | undefined): void {
  queryClient.removeQueries({
    predicate: (query) => isSignedOutViewerQuery(query.queryKey, previousUserId),
  });
}
