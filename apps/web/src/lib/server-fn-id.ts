const HANDLER_SUFFIX = /_createServerFn_handler$/u;
// Start appends `_<n>` when two functions produce the same id.
const ID_PATTERN = /^\/_serverFn\/(?<name>[A-Za-z_$][\w$]*)\.[0-9a-f]{16}(?:_\d+)?$/u;

/**
 * The production server function id: the function's name, readable in traces and logs, then a
 * digest of its file and name that keeps ids unique. Passed to Start's `generateFunctionId`.
 */
export function serverFnId(functionName: string, digestHex: string): string {
  return `${functionName.replace(HANDLER_SUFFIX, "")}.${digestHex.slice(0, 16)}`;
}

/** The function name a production server function request path carries, if it is one. */
export function serverFnNameFromPath(pathname: string): string | undefined {
  return ID_PATTERN.exec(pathname)?.groups?.name;
}
