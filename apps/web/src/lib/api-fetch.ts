import {
  API_FORMAT_HEADER,
  API_FORMAT_VERSION,
  BUILD_ID_HEADER,
  isBuildIdSafe,
} from "@openrift/shared/contracts/api-format";

import { appendScanJournal, hasScanJournal } from "@/features/scan/lib/scan-journal";

import { COMMIT_HASH } from "./env";
import { reloadForNewVersion, scheduleReloadFlagClear } from "./stale-bundle-reload";

function announceNewVersion(reason: string): void {
  if (hasScanJournal()) {
    appendScanJournal({ type: "reload-prompt" });
  }
  reloadForNewVersion(reason);
}

// API_FORMAT_HEADER describes the body, so it stays valid on a cached
// response replayed later.
function apiFormatOf(response: Response): number | undefined {
  const raw = response.headers.get(API_FORMAT_HEADER);
  if (raw === null) {
    return undefined;
  }
  const format = Math.trunc(Number(raw));
  return Number.isNaN(format) ? undefined : format;
}

/** Releases the connection of a response whose body will never be read. */
export async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Already closed or errored; nothing left to release.
  }
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  return (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
}

function cacheModeOf(input: RequestInfo | URL, init?: RequestInit): RequestCache | undefined {
  return init?.cache ?? (input instanceof Request ? input.cache : undefined);
}

/**
 * `fetch` for the browser's own API and server-function requests: reads the
 * build id and payload format off each response to detect a newer deploy.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await globalThis.fetch(input, init);
  if (globalThis.window === undefined || !COMMIT_HASH) {
    return response;
  }
  // A cached response's build id reflects an old deploy and would false-trigger a reload.
  const buildId = isBuildIdSafe(response.headers.get("Cache-Control"))
    ? response.headers.get(BUILD_ID_HEADER)
    : null;
  if (buildId && buildId !== COMMIT_HASH) {
    announceNewVersion(`${BUILD_ID_HEADER} mismatch (server=${buildId}, client=${COMMIT_HASH})`);
  } else if (buildId) {
    scheduleReloadFlagClear();
  }
  const format = apiFormatOf(response);
  if (format === undefined || format === API_FORMAT_VERSION) {
    return response;
  }
  if (format > API_FORMAT_VERSION) {
    announceNewVersion(`API format ${format} is newer than this bundle's ${API_FORMAT_VERSION}`);
    return response;
  }
  if (methodOf(input, init) !== "GET" || cacheModeOf(input, init) === "no-store") {
    return response;
  }
  console.warn(
    `[stale-bundle] cache-served API format ${format} predates this bundle's ${API_FORMAT_VERSION}, refetching fresh`,
  );
  void discardBody(response);
  return globalThis.fetch(input, { ...init, cache: "no-store" });
}
