import { m } from "@/paraglide/messages.js";

/**
 * React Compiler bails on a component with a conditional inside try/catch.
 * Call this from the catch block; don't inline one.
 */
export function errorText(thrown: unknown, fallback: string): string {
  if (isNetworkError(thrown)) {
    return m.common_network_error();
  }
  const message = thrown instanceof Error ? thrown.message.trim() : "";
  return message === "" ? fallback : message;
}

// A server-fn error loses its prototype crossing the boundary, arriving as a
// plain object that still carries `message`.
export function thrownMessage(thrown: unknown): string {
  if (typeof thrown === "object" && thrown !== null) {
    const { message } = thrown as { message?: unknown };
    return typeof message === "string" ? message : "";
  }
  return typeof thrown === "string" ? thrown : "";
}

// Matches each browser's phrasing for a dynamic-import failure (Chrome,
// Firefox, Safari) plus webpack's ChunkLoadError. Shared with
// sentry-client.ts to filter these out of Sentry before the reload fires.
export const CHUNK_LOAD_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/u;

export const NETWORK_ERROR_MESSAGES = [
  "Load failed",
  "Failed to fetch",
  "NetworkError when attempting to fetch resource",
];

export function isNetworkError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 5 && current !== undefined && current !== null; depth++) {
    const message = thrownMessage(current);
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
