import { enumLabel, labelMap } from "@openrift/shared/enum-label";
import type { LabelMap } from "@openrift/shared/enum-label";

import type { Repos } from "../../../deps.js";

export async function deckFormatLabel(
  deckFormats: Pick<Repos["deckFormats"], "getBySlug">,
  format: string,
): Promise<string> {
  const row = await deckFormats.getBySlug(format);
  return enumLabel(labelMap(row ? [row] : []), format);
}

export async function deckZoneLabels(enums: Pick<Repos["enums"], "deckZones">): Promise<LabelMap> {
  return labelMap(await enums.deckZones());
}
