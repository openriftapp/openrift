import type { PresenceDimension } from "@openrift/shared/types/search";

import { m } from "@/paraglide/messages.js";

export type PresenceParamValue = "any" | "none" | null;

export function presenceToFlagState(value: PresenceParamValue): boolean | null {
  return value === "any" ? true : value === "none" ? false : null;
}

export function presenceFlagCount(
  counts: { any: number; none: number } | undefined,
  state: boolean | null,
): number | undefined {
  if (!counts) {
    return undefined;
  }
  return state === false ? counts.none : counts.any;
}

export function presenceLabel(dimension: PresenceDimension): string {
  switch (dimension) {
    case "markers": {
      return m.cards_filter_presence_markers();
    }
    case "superTypes": {
      return m.cards_filter_presence_super_types();
    }
    case "customTags": {
      return m.cards_filter_presence_custom_tags();
    }
    case "distributionChannels": {
      return m.cards_filter_presence_channels();
    }
    case "keywords": {
      return m.cards_filter_presence_keywords();
    }
    case "tags": {
      return m.cards_filter_presence_tags();
    }
  }
}
