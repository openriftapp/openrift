// oxlint-disable-next-line import/no-nodejs-modules -- server-side hashing, never reaches the browser
import { createHash } from "node:crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** NUL-joined so `["ab", "c"]` and `["a", "bc"]` hash differently. */
export function stableKey(parts: readonly string[], length: number): string {
  return sha256Hex(parts.join("\0")).slice(0, length);
}
