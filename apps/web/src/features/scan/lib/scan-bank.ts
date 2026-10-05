import type { EmbedBank } from "@openrift/shared/scan/embed";
import { decodeEmbedBank } from "@openrift/shared/scan/embed-format";
import type { CardLabels } from "@openrift/shared/scan/labels";
import { WellKnown } from "@openrift/shared/well-known";

import { scanAssetError } from "@/features/scan/lib/scan-asset-hint";
import type { ScanWorkerReady } from "@/features/scan/lib/scan-worker-protocol";
import { fetchWithProgress } from "@/lib/fetch-progress";

/** The decoded bank with its vectors; only the scan worker holds one. */
export interface LoadedScanBank {
  bank: EmbedBank;
  artKeys: Map<string, string>;
  labels: CardLabels;
  bytes: number;
  canonical: boolean;
}

export interface ScanBankInfo {
  keys: readonly string[];
  artKeys: Map<string, string>;
  labels: CardLabels;
  bytes: number;
}

export async function loadScanLabels(labelsUrl: string): Promise<CardLabels> {
  const response = await fetch(labelsUrl);
  return response.ok ? ((await response.json()) as CardLabels) : {};
}

/** media/scan/{bank,labels} are published by the bank rebuild job and are not committed. */
export async function loadScanBank(
  bankUrl: string,
  labelsUrl: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<LoadedScanBank> {
  const [buffer, labels] = await Promise.all([
    fetchWithProgress(bankUrl, onProgress, scanAssetError("the scan bank", bankUrl)),
    loadScanLabels(labelsUrl),
  ]);
  const { bank, artKeys, canonical } = decodeEmbedBank(buffer);
  return { bank, artKeys, labels, bytes: buffer.byteLength, canonical };
}

export function scanBankInfo(labels: CardLabels, ready: ScanWorkerReady): ScanBankInfo {
  return {
    keys: ready.keys,
    artKeys: new Map(ready.artKeys),
    labels,
    bytes: ready.bytes,
  };
}

export function describeKey(labels: CardLabels, key: string): string {
  const label = labels[key];
  return label ? `${label.name} (${label.code} ${label.language})` : `unknown ${key.slice(0, 8)}`;
}

/** Scan surfaces only have bank labels, not catalogue printings, so the label's type is the orientation source. */
export function isLandscapeKey(labels: CardLabels, key: string): boolean {
  return labels[key]?.type === WellKnown.cardType.BATTLEFIELD;
}
