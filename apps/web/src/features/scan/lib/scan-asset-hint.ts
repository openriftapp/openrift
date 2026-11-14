import { errorMessage } from "@openrift/shared/strings";

import type { ScanAsset } from "@/features/scan/lib/scan-worker-protocol";

/**
 * A download failure always means the manifest names a generation the media
 * directory does not have (e.g. after restoring a DB dump from production,
 * whose `scan_index` row names a generation only production's media has).
 */
export function scanAssetError(what: string, url: string): string {
  return `Could not load ${what} from ${url} (the manifest names a generation that is missing from media/scan, so rebuild the bank from /admin/scan or copy it from production)`;
}

export class ScanAssetLoadError extends Error {
  readonly asset: ScanAsset;

  constructor(asset: ScanAsset, cause: unknown) {
    super(errorMessage(cause), { cause });
    this.name = "ScanAssetLoadError";
    this.asset = asset;
  }
}

export async function loadingAsset<T>(asset: ScanAsset, load: Promise<T>): Promise<T> {
  try {
    return await load;
  } catch (error) {
    throw new ScanAssetLoadError(asset, error);
  }
}
