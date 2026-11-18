import { errorMessage } from "@openrift/shared/strings";

import { COMMIT_HASH } from "@/lib/env";
import { CHUNK_LOAD_ERROR_PATTERN, thrownMessage } from "@/lib/error-text";
// No UI imports here: router.ts and sentry-client.ts import this module
// statically, and pulling in the toast library would enter the SSR module graph.

/** Holds the build id the last automatic reload left from. */
const RELOAD_FLAG = "openrift:reload-attempted";

let newVersionAvailable = false;

export function markNewVersionAvailable(): boolean {
  if (newVersionAvailable) {
    return false;
  }
  newVersionAvailable = true;
  return true;
}

/** stale-bundle.ts overwrites this at import time before any event listener fires. */
let staleNotifier = (reason: string): void => {
  console.warn(`[stale-bundle] ${reason} — reload blocked and no notifier registered`);
};

export function setStaleNotifier(notify: (reason: string) => void): void {
  staleNotifier = notify;
}

/** Bypasses the RELOAD_FLAG loop guard on purpose: a click cannot loop the way an automatic reload can. */
export function forceReload(reason: string): void {
  if (globalThis.window === undefined) {
    return;
  }
  console.warn(`[stale-bundle] ${reason} — user-initiated reload`);
  globalThis.location.reload();
}

/**
 * Reloads once per build: a page still on the build an earlier reload left from gained
 * nothing by it, so it prompts instead. Returns false when it prompted.
 */
function reloadOnce(reason: string): boolean {
  if (globalThis.window === undefined) {
    return false;
  }
  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === COMMIT_HASH) {
      console.warn(
        `[stale-bundle] ${reason} — auto-reload already attempted from this build, prompting instead`,
      );
      staleNotifier(reason);
      return false;
    }
    sessionStorage.setItem(RELOAD_FLAG, COMMIT_HASH);
  } catch {
    // sessionStorage unavailable (private mode, sandboxed iframe): use the
    // toast to avoid an unguarded reload loop.
    staleNotifier(reason);
    return false;
  }
  console.warn(`[stale-bundle] ${reason} — reloading to pick up new bundle`);
  globalThis.location.reload();
  return true;
}

/** A shell still served stale after the reload falls back to the toast. */
export function reloadForNewVersion(reason: string): boolean {
  if (!markNewVersionAvailable()) {
    return false;
  }
  return reloadOnce(reason);
}

/**
 * An error thrown on a tab whose bundle predates the deployed server is a
 * deploy artifact, so the error boundary reloads through this instead.
 */
export function reloadIfNewVersionPending(): boolean {
  return newVersionAvailable && reloadOnce("new version pending — reloading after a render error");
}

// Subscribes to `onResolved` (not an earlier navigation event) so the URL bar
// already holds the destination when reloadOnce() fires, and reloads land on
// the page the user actually navigated to.
interface RouterSubscribe {
  subscribe: (eventType: "onResolved", callback: () => void) => () => void;
}

export function initVersionStaleNavigationReload(router: RouterSubscribe): void {
  if (globalThis.window === undefined) {
    return;
  }
  router.subscribe("onResolved", () => {
    if (newVersionAvailable) {
      reloadOnce("new version pending — reloading on navigation");
    }
  });
}

/**
 * serverFnFetch throws StaleServerFnError (lib/stale-server-fn-signal.ts) for the server's
 * stale-function signal.
 */
export function isStaleServerFnError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "StaleServerFnError"
  );
}

/**
 * A polling query never navigates, so the soft toast + reload-on-navigation
 * path can't recover it; reload immediately instead.
 */
export function reloadIfStaleServerFnError(error: unknown): boolean {
  if (!isStaleServerFnError(error)) {
    return false;
  }
  reloadOnce("server function not found — client bundle mismatch");
  return true;
}

function chunkLoadErrorMessage(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 5 && current !== undefined && current !== null; depth++) {
    const message = thrownMessage(current);
    if (CHUNK_LOAD_ERROR_PATTERN.test(message)) {
      return message;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return undefined;
}

export function hasChunkLoadError(error: unknown): boolean {
  return chunkLoadErrorMessage(error) !== undefined;
}

/**
 * React wraps a render-time import failure in its own error and hands it to
 * the root callbacks, which never reach initChunkErrorReloader's listeners.
 */
export function reloadIfChunkLoadError(error: unknown): boolean {
  const message = chunkLoadErrorMessage(error);
  if (message === undefined) {
    return false;
  }
  reloadOnce(`chunk load error: ${message}`);
  return true;
}

function isBareThrow(reason: unknown): boolean {
  return reason === undefined || reason === null || reason === "";
}

/**
 * A bare `throw undefined` (or null, or "") in render escapes every error boundary and leaves a
 * white page. client.tsx routes React's uncaught render errors here; a bare throw outside render
 * leaves the page standing, so the window listeners do not reload for one.
 */
export function reloadIfUncaughtBareThrow(error: unknown): boolean {
  if (!isBareThrow(error)) {
    return false;
  }
  reloadOnce(`bare throw (${String(error)}) escaped React error boundaries`);
  return true;
}

// Deliberately NOT reset by _resetReloadStateForTesting: the one installed
// listener pair stays live for the whole test file and reads the (reset)
// module state at call time.
let chunkErrorReloaderInstalled = false;

export function initChunkErrorReloader(): void {
  if (globalThis.window === undefined || chunkErrorReloaderInstalled) {
    return;
  }
  chunkErrorReloaderInstalled = true;
  const isChunkLoadError = (message: string): boolean => CHUNK_LOAD_ERROR_PATTERN.test(message);
  globalThis.addEventListener("error", (event) => {
    if (isChunkLoadError(event.message)) {
      reloadOnce(`chunk load error: ${event.message}`);
    }
  });
  globalThis.addEventListener("unhandledrejection", (event) => {
    const message = thrownMessage(event.reason);
    if (isChunkLoadError(message)) {
      reloadOnce(`chunk load error: ${message}`);
    }
  });
  // No preventDefault(): calling it makes Vite's preload helper resolve the
  // import with `undefined` instead of rethrowing, so this listener would never fire.
  globalThis.addEventListener("vite:preloadError", (event) => {
    // Vite types payload as Error, but the helper passes whatever the import rejected with
    // (undefined included). Drop the guard once Vite types it as unknown.
    const payload: unknown = event.payload;
    reloadOnce(`vite preload error: ${errorMessage(payload)}`);
  });
}

/**
 * The notifier registration is deliberately left alone: stale-bundle.ts
 * installs it once at import time, exactly like in the real app.
 */
export function _resetReloadStateForTesting(): void {
  if (globalThis.window !== undefined) {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      // ignore
    }
  }
  newVersionAvailable = false;
}
