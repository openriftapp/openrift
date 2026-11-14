import { legendDisplayName } from "@openrift/shared/card-name";
import type { CardLabels } from "@openrift/shared/scan/labels";

import { isLandscapeKey } from "@/features/scan/lib/scan-bank";
import type { ScanPrintingIndex } from "@/features/scan/lib/scan-resolve";

export interface IdentifyCandidate {
  key: string;
  artKey: string;
  name: string | null;
  detail: string;
  landscape: boolean;
}

export function scanKeyName(
  index: ScanPrintingIndex,
  labels: CardLabels,
  key: string,
): string | null {
  const printing = index.byImageId.get(key)?.[0];
  if (printing) {
    return legendDisplayName(printing.card);
  }
  return labels[key]?.name ?? null;
}

export function toIdentifyCandidates(
  index: ScanPrintingIndex,
  labels: CardLabels,
  candidates: readonly { key: string; artKey: string }[],
): IdentifyCandidate[] {
  return candidates.map((candidate) => {
    const label = labels[candidate.key];
    return {
      key: candidate.key,
      artKey: candidate.artKey,
      name: scanKeyName(index, labels, candidate.key),
      detail: label ? `${label.code} ${label.language}` : "",
      landscape: isLandscapeKey(labels, candidate.key),
    };
  });
}
