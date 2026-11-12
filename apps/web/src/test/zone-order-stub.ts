import { labelMapOf } from "@openrift/shared/enum-label";
import type { DeckZone } from "@openrift/shared/types/enums";

const TEST_ZONE_ORDER: DeckZone[] = [
  "legend",
  "legend-options",
  "champion",
  "runes",
  "battlefield",
  "main",
  "sideboard",
  "overflow",
];

export const TEST_ZONE_LABELS = labelMapOf({
  legend: "Legend",
  "legend-options": "Extra Legends",
  champion: "Chosen Champion",
  runes: "Runes",
  battlefield: "Battlefields",
  main: "Main Deck",
  sideboard: "Sideboard",
  overflow: "Overflow",
});

export function useZoneOrderStub() {
  return { zoneOrder: TEST_ZONE_ORDER, zoneLabels: TEST_ZONE_LABELS };
}
