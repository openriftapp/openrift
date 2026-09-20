export interface CopyDeltaKeyset {
  xid: string;
  id: string;
}

export interface CopyDeltaCursor {
  safeXid: string;
  row?: CopyDeltaKeyset;
  deletion?: CopyDeltaKeyset;
}

function encode(keyset?: CopyDeltaKeyset): string {
  return keyset === undefined ? "" : `${keyset.xid}_${keyset.id}`;
}

function decode(part: string): CopyDeltaKeyset | undefined {
  const separator = part.indexOf("_");
  if (separator === -1) {
    return undefined;
  }
  return { xid: part.slice(0, separator), id: part.slice(separator + 1) };
}

export function buildCopyDeltaCursor(cursor: CopyDeltaCursor): string {
  return `${cursor.safeXid}~${encode(cursor.row)}~${encode(cursor.deletion)}`;
}

/** The contract's `deltaCursorSchema` has already rejected any other shape. */
export function parseCopyDeltaCursor(cursor: string): CopyDeltaCursor {
  const [safeXid = "", row = "", deletion = ""] = cursor.split("~");
  return { safeXid, row: decode(row), deletion: decode(deletion) };
}
