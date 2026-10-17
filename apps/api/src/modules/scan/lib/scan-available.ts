import type { Config } from "../../../types.js";
import type { ScanIndexRow } from "../repositories/scan-index.js";

export function isScanAvailable(
  index: ScanIndexRow | null,
  scan: Pick<Config["scan"], "detectorFile">,
): boolean {
  return index !== null && scan.detectorFile !== null;
}
