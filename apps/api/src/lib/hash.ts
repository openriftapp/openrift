import { createHash } from "node:crypto";

export function sha256HexSync(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** NUL-joined so `["ab", "c"]` and `["a", "bc"]` hash differently. */
export function stableKey(parts: readonly string[], length: number): string {
  return sha256HexSync(parts.join("\0")).slice(0, length);
}
