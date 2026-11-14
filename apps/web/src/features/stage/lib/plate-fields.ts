import type { OverlayPlateFields } from "@openrift/shared/contracts/overlay";

import { m } from "@/paraglide/messages.js";

export function plateFieldOptions(): { key: keyof OverlayPlateFields; label: string }[] {
  return [
    { key: "name", label: m.stage_plate_field_name() },
    { key: "code", label: m.stage_plate_field_code() },
    { key: "stats", label: m.stage_plate_field_stats() },
    { key: "rulesText", label: m.stage_plate_field_rules_text() },
    { key: "flavorText", label: m.stage_plate_field_flavor_text() },
  ];
}
