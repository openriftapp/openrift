import type { QueryClient } from "@tanstack/react-query";

import { refreshViewerAfterSignOut } from "@/lib/viewer-change";
import type { ResetPhase } from "@/stores/client-state-reset";

type ResetClientState = (phase: ResetPhase) => Promise<void>;

/** Loaded on demand so the persisted stores stay out of the entry chunk. Never rejects. */
export async function loadClientStateReset(): Promise<ResetClientState | null> {
  try {
    const { resetClientState } = await import("@/stores/client-state-reset");
    return resetClientState;
  } catch {
    return null;
  }
}

/**
 * Sign-out and account deletion. The shell cookies reset before `leave` because root
 * beforeLoad reads them; the rest after the signed-in page has unmounted and flushed.
 */
export async function leaveAsSignedOut(
  queryClient: QueryClient,
  leave: () => Promise<unknown>,
  reset?: Promise<ResetClientState | null>,
): Promise<void> {
  const resetClientState = await (reset ?? loadClientStateReset());
  await resetClientState?.("before-leave");
  await refreshViewerAfterSignOut(queryClient, leave);
  await resetClientState?.("after-leave");
}
