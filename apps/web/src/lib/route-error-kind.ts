import { errorStatus } from "@/lib/server-fns/api-error";
import {
  CHUNK_LOAD_ERROR_PATTERN,
  hasChunkLoadError,
  isStaleServerFnError,
} from "@/lib/stale-bundle-reload";

export const NETWORK_ERROR_MESSAGES = [
  "Load failed",
  "Failed to fetch",
  "NetworkError when attempting to fetch resource",
];

export type RouteErrorKind = "offline" | "forbidden" | "failed";

function messageOf(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const { message } = error as { message?: unknown };
    return typeof message === "string" ? message : "";
  }
  return typeof error === "string" ? error : "";
}

export function isNetworkError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 5 && current !== undefined && current !== null; depth++) {
    const message = messageOf(current);
    if (
      !CHUNK_LOAD_ERROR_PATTERN.test(message) &&
      NETWORK_ERROR_MESSAGES.some((prefix) => message.startsWith(prefix))
    ) {
      return true;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}

export function routeErrorKind(error: unknown, online: boolean): RouteErrorKind {
  if (!online || isNetworkError(error)) {
    return "offline";
  }
  const status = errorStatus(error);
  if (status === 401 || status === 403) {
    return "forbidden";
  }
  return "failed";
}

/** A deploy-skew error: only a fresh page load can fix it. */
export function needsFullReload(error: unknown): boolean {
  return hasChunkLoadError(error) || isStaleServerFnError(error);
}
