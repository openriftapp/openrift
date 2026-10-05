export type JsonParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const INVALID_JSON_ERROR = "Invalid JSON file";

/** Element shapes are left to the server, which reports per-entry errors. */
export function parseJsonEntries<T>(
  text: string,
  field: string,
  emptyError: string,
): JsonParseResult<T[]> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: INVALID_JSON_ERROR };
  }
  const list =
    Array.isArray(json) || typeof json !== "object" || json === null
      ? json
      : (json as Record<string, unknown>)[field];
  if (!Array.isArray(list) || list.length === 0) {
    return { ok: false, error: emptyError };
  }
  return { ok: true, value: list as T[] };
}
