const KEY_PREFIX = "openrift-join-intent:";

function withSession<T>(fallback: T, run: (storage: Storage) => T): T {
  try {
    return run(globalThis.sessionStorage);
  } catch {
    return fallback;
  }
}

/** Set by a click on the join page, so a link alone can never file a request. */
export function rememberJoinIntent(code: string): void {
  withSession(undefined, (storage) => storage.setItem(`${KEY_PREFIX}${code}`, "1"));
}

export function hasJoinIntent(code: string): boolean {
  return withSession(false, (storage) => storage.getItem(`${KEY_PREFIX}${code}`) === "1");
}

export function forgetJoinIntent(code: string): void {
  withSession(undefined, (storage) => storage.removeItem(`${KEY_PREFIX}${code}`));
}
