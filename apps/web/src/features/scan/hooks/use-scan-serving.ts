import type { ScanManifest } from "@openrift/shared/contracts/scan";
import { scanContract } from "@openrift/shared/contracts/scan";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { scanKeys } from "@/features/scan/lib/scan-query-keys";
import type { ScanAssets } from "@/features/scan/lib/scan-worker-protocol";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

interface ScanServingAssets extends ScanAssets {
  bankHash: string | null;
  entryCount: number | null;
  builtAt: string | null;
}

// No local fallback: an unpublished bank or card detector leaves the scanner unavailable.
export type ScanServing =
  | { status: "loading"; assets: null }
  | { status: "unavailable"; assets: null }
  | { status: "ready"; assets: ScanServingAssets };

const fetchScanManifestFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<ScanManifest> =>
    apiOrpcClient(scanContract, context.cookie).manifest(),
  );

export function useScanServing(): ScanServing {
  const manifest = useQuery({
    queryKey: scanKeys.manifest,
    queryFn: () => fetchScanManifestFn(),
    staleTime: 60_000,
    retry: 1,
  });
  if (manifest.isPending) {
    return { status: "loading", assets: null };
  }
  const data = manifest.data;
  if (
    !data?.available ||
    data.bankUrl === null ||
    data.labelsUrl === null ||
    data.detectorUrl === null
  ) {
    return { status: "unavailable", assets: null };
  }
  return {
    status: "ready",
    assets: {
      bankUrl: data.bankUrl,
      labelsUrl: data.labelsUrl,
      encoderUrl: data.encoderUrl,
      detectorUrl: data.detectorUrl,
      boardDetectorUrl: data.boardDetectorUrl,
      bankHash: data.bankHash,
      entryCount: data.entryCount,
      builtAt: data.builtAt,
    },
  };
}
