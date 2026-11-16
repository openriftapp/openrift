// No imports: instrument.server.mjs loads this before Sentry is initialised.

/** Set on the response to a server-function id the deployed manifest does not hold. */
export const STALE_SERVER_FN_HEADER = "X-Stale-Server-Fn";
export const STALE_SERVER_FN_STATUS = 404;

// Start's generated resolver (start-plugin-core server-fn-resolver-module) throws a plain
// Error for an id missing from the manifest. stale-server-fn-signal.test.ts pins the wording.
export const START_MISSING_SERVER_FN_PATTERN =
  /Server function (?:info not found|module not resolved) for /u;

export function isStartMissingServerFnError(error: unknown): error is Error {
  return error instanceof Error && START_MISSING_SERVER_FN_PATTERN.test(error.message);
}

/** Thrown by `serverFnFetch` for a response carrying {@link STALE_SERVER_FN_HEADER}; matched by name. */
export class StaleServerFnError extends Error {
  constructor(url: string) {
    super(`Server function at ${url} is not in the deployed build`);
    this.name = "StaleServerFnError";
  }
}
