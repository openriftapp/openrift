import { isNetworkError } from "@/lib/error-text";
import { errorStatus } from "@/lib/server-fns/api-error";
import { hasChunkLoadError, isStaleServerFnError } from "@/lib/stale-bundle-reload";

export type RouteErrorKind = "offline" | "forbidden" | "failed";

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
