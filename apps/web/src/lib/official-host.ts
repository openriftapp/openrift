import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

// Deliberately not env-backed: changing it must take a fork.
export const OFFICIAL_HOST = "openrift.app";

export function isOfficialHostname(hostname: string): boolean {
  return hostname === OFFICIAL_HOST;
}

// The dev server counts as official so the legal pages and footer can be worked on locally.
export const isOfficialInstance = createIsomorphicFn()
  .server(() => import.meta.env.DEV || isOfficialHostname(new URL(getRequest().url).hostname))
  .client(() => import.meta.env.DEV || isOfficialHostname(globalThis.location.hostname));
