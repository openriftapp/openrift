import type { ScanAsset } from "@/features/scan/lib/scan-worker-protocol";
import { errorText } from "@/lib/error-text";
import { m } from "@/paraglide/messages.js";

const ASSET_NAMES: Record<ScanAsset, string> = {
  labels: "Card labels",
  bank: "Card bank",
  encoder: "Encoder model",
  detector: "Card detector",
};

export class ScanWorkerFailureError extends Error {
  readonly asset: ScanAsset | undefined;

  constructor(message: string, asset?: ScanAsset) {
    super(message);
    this.name = "ScanWorkerFailureError";
    this.asset = asset;
  }
}

export function engineLoadFailure(thrown: unknown): string {
  const reason = errorText(thrown, m.scan_engine_start_failed());
  const asset = thrown instanceof ScanWorkerFailureError ? thrown.asset : undefined;
  return asset === undefined ? reason : `${ASSET_NAMES[asset]}: ${reason}`;
}
