import type { QueryClient } from "@tanstack/react-query";

import { refreshViewer, refreshViewerAfterSignOut } from "@/lib/viewer-change";
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

export const CLIENT_STATE_OWNER_KEY = "openrift-client-state-owner";

function clientStateOwner(): string | null {
  try {
    return localStorage.getItem(CLIENT_STATE_OWNER_KEY);
  } catch {
    return null;
  }
}

function setClientStateOwner(userId: string): void {
  try {
    localStorage.setItem(CLIENT_STATE_OWNER_KEY, userId);
  } catch {
    // Storage blocked: the per-account stores cannot persist either.
  }
}

export function forgetClientStateOwner(): void {
  try {
    localStorage.removeItem(CLIENT_STATE_OWNER_KEY);
  } catch {
    // Storage blocked: nothing was written either.
  }
}

/** False while another account's state is still on this device, so nothing may save it as this account's. */
export function ownsClientState(userId: string): boolean {
  const owner = clientStateOwner();
  return owner === null || owner === userId;
}

/** A failed chunk load keeps the previous owner, so the next page load retries the reset. */
async function resetForAccount(userId: string): Promise<void> {
  const reset = await import("@/stores/client-state-reset").catch(() => null);
  if (reset) {
    await reset.resetClientStateForAccountSwitch();
    setClientStateOwner(userId);
  }
}

/** Null when the state already belongs to `userId`; else resolves once another account's state is reset. */
export function claimClientState(userId: string): Promise<void> | null {
  if (ownsClientState(userId)) {
    setClientStateOwner(userId);
    return null;
  }
  return resetForAccount(userId);
}

/** Claims the stores before the session flips, so no render or write sees the previous account's state. */
export async function enterAsSignedIn(queryClient: QueryClient, userId?: string): Promise<void> {
  if (userId) {
    await claimClientState(userId);
  }
  await refreshViewer(queryClient);
}
