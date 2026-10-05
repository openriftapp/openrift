/**
 * Shared pieces of the xid-watermarked delta reads (decks, copies): the server
 * pins a safe xid per read, and page cursors carry `<xid>_<id>` keysets.
 */

export interface XidKeyset {
  xid: string;
  id: string;
}

/** The cursor's watermark is client input, so it may only narrow the window, never widen it. */
export function pinWatermark(currentSafeXid: string, cursorSafeXid?: string): string {
  return cursorSafeXid !== undefined && BigInt(cursorSafeXid) < BigInt(currentSafeXid)
    ? cursorSafeXid
    : currentSafeXid;
}

export function encodeXidKeyset(keyset?: XidKeyset): string {
  return keyset === undefined ? "" : `${keyset.xid}_${keyset.id}`;
}

/** Splits on the first underscore, so a uuid's dashes survive. */
export function decodeXidKeyset(part: string): XidKeyset | undefined {
  const separator = part.indexOf("_");
  if (separator === -1) {
    return undefined;
  }
  return { xid: part.slice(0, separator), id: part.slice(separator + 1) };
}

export function clampPageLimit(limit: number | undefined, max: number): number {
  return Math.min(limit ?? max, max);
}

/** `rows` is read with `limit + 1`; the extra row only signals that another page follows. */
export function takePage<T>(rows: readonly T[], limit: number): { page: T[]; drained: boolean } {
  return { page: rows.slice(0, limit), drained: rows.length <= limit };
}
