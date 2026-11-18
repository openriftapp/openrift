import { m } from "@/paraglide/messages.js";

import { apiFetch } from "./api-fetch";
import { COMMIT_HASH } from "./env";
import {
  _resetReloadStateForTesting,
  forceReload,
  markNewVersionAvailable,
  setStaleNotifier,
} from "./stale-bundle-reload";
import { toastMessage } from "./toast";

// Reload mechanics live in stale-bundle-reload.ts, kept separate so router.ts
// and sentry-client.ts stay clear of the toast layer.

const NEW_VERSION_TOAST_ID = "openrift:new-version";

let prompted = false;

function promptNewVersion(reason: string): void {
  markNewVersionAvailable();
  if (prompted) {
    return;
  }
  prompted = true;
  console.warn(`[stale-bundle] ${reason} — prompting to reload for the new version`);
  toastMessage(m.common_new_version_available(), {
    id: NEW_VERSION_TOAST_ID,
    duration: Number.POSITIVE_INFINITY,
    action: {
      label: m.common_reload(),
      onClick: () => forceReload(reason),
    },
  });
}

// Set here, not in stale-bundle-reload.ts, to keep the toast layer out of that module.
setStaleNotifier(promptNewVersion);

// Idle tabs make no API calls, so apiFetch never sees a fresh build id;
// ping health on refocus to give it one.
const VISIBILITY_CHECK_MIN_INTERVAL_MS = 30_000;
let lastVisibilityCheckMs = 0;

async function pingHealth(): Promise<void> {
  try {
    await apiFetch("/api/health", { cache: "no-store" });
  } catch {
    // Offline or backend down — the next real API call or refocus retries.
  }
}

export function initVisibilityVersionCheck(): void {
  if (globalThis.window === undefined || !COMMIT_HASH) {
    return;
  }
  globalThis.document.addEventListener("visibilitychange", () => {
    if (globalThis.document.visibilityState !== "visible") {
      return;
    }
    const now = Date.now();
    if (now - lastVisibilityCheckMs < VISIBILITY_CHECK_MIN_INTERVAL_MS) {
      return;
    }
    lastVisibilityCheckMs = now;
    void pingHealth();
  });
}

export function _resetReloadFlagForTesting(): void {
  _resetReloadStateForTesting();
  prompted = false;
  lastVisibilityCheckMs = 0;
}
