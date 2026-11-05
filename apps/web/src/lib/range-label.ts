import { NONE } from "@openrift/shared/types/search";

import { m } from "@/paraglide/messages.js";

/** Label for an active numeric range filter, handling the NONE sentinel and open-ended bounds. */
export function rangeBadgeLabel(
  min: number | null,
  max: number | null,
  availableMin: number,
  availableMax: number,
  formatValue: (value: number) => string = String,
): string {
  const resolvedMin = min ?? availableMin;
  const resolvedMax = max ?? availableMax;
  const fmtNone = (value: number) =>
    value === NONE ? m.cards_filter_range_none() : formatValue(value);

  if (resolvedMin === NONE && resolvedMax === NONE) {
    return m.cards_filter_range_none();
  }
  if (resolvedMin === NONE) {
    return max === null
      ? m.cards_filter_range_at_least({ value: m.cards_filter_range_none() })
      : m.cards_filter_range_between({
          min: m.cards_filter_range_none(),
          max: formatValue(resolvedMax),
        });
  }
  if (resolvedMin === resolvedMax) {
    return formatValue(resolvedMin);
  }
  if (min !== null && max !== null) {
    return m.cards_filter_range_between({ min: fmtNone(resolvedMin), max: fmtNone(resolvedMax) });
  }
  if (min === null) {
    return m.cards_filter_range_at_most({ value: fmtNone(resolvedMax) });
  }
  return m.cards_filter_range_at_least({ value: fmtNone(resolvedMin) });
}
