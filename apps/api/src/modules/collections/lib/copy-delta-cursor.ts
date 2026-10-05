import type { XidKeyset } from "../../../lib/xid-watermark.js";
import { decodeXidKeyset, encodeXidKeyset } from "../../../lib/xid-watermark.js";

export interface CopyDeltaCursor {
  safeXid: string;
  row?: XidKeyset;
  deletion?: XidKeyset;
}

export function buildCopyDeltaCursor(cursor: CopyDeltaCursor): string {
  return `${cursor.safeXid}~${encodeXidKeyset(cursor.row)}~${encodeXidKeyset(cursor.deletion)}`;
}

/** The contract's `deltaCursorSchema` has already rejected any other shape. */
export function parseCopyDeltaCursor(cursor: string): CopyDeltaCursor {
  const [safeXid = "", row = "", deletion = ""] = cursor.split("~");
  return { safeXid, row: decodeXidKeyset(row), deletion: decodeXidKeyset(deletion) };
}
