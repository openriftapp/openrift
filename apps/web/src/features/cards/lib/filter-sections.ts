import { PREFERENCE_DEFAULTS } from "@openrift/shared/types/api/preferences";

import type { FilterDimensionAvailability } from "@/features/cards/lib/filter-dimensions";
import { sectionHasContent } from "@/features/cards/lib/filter-dimensions";
import { m } from "@/paraglide/messages.js";

export interface FilterPlacementUnit {
  key: string;
  sections: readonly string[];
}

export const FILTER_PLACEMENT_UNITS: readonly FilterPlacementUnit[] = [
  { key: "languages", sections: ["languages"] },
  { key: "sets", sections: ["sets"] },
  { key: "domains", sections: ["domains"] },
  { key: "rarities", sections: ["rarities"] },
  { key: "types", sections: ["types"] },
  { key: "superTypes", sections: ["superTypes"] },
  { key: "variant", sections: ["artVariants", "finishes", "overnumbered", "signed"] },
  { key: "standard", sections: ["standard"] },
  { key: "stats", sections: ["energy", "power", "might"] },
  { key: "markers", sections: ["markers"] },
  { key: "cardSizes", sections: ["cardSizes"] },
  { key: "channels", sections: ["channels"] },
  { key: "customTags", sections: ["customTags"] },
  { key: "tags", sections: ["tags"] },
  { key: "keywords", sections: ["keywords"] },
  { key: "banned", sections: ["banned"] },
  { key: "errata", sections: ["errata"] },
  { key: "noImage", sections: ["noImage"] },
  { key: "owned", sections: ["owned"] },
  { key: "price", sections: ["price"] },
];

export function placementUnitLabel(key: string): string {
  switch (key) {
    case "languages": {
      return m.cards_filter_unit_languages();
    }
    case "sets": {
      return m.cards_filter_unit_sets();
    }
    case "domains": {
      return m.cards_filter_unit_domains();
    }
    case "rarities": {
      return m.cards_filter_unit_rarities();
    }
    case "types": {
      return m.cards_filter_unit_types();
    }
    case "superTypes": {
      return m.cards_filter_unit_super_types();
    }
    case "variant": {
      return m.cards_filter_unit_variant();
    }
    case "standard": {
      return m.cards_filter_unit_standard();
    }
    case "stats": {
      return m.cards_filter_unit_stats();
    }
    case "markers": {
      return m.cards_filter_unit_markers();
    }
    case "cardSizes": {
      return m.cards_filter_unit_card_sizes();
    }
    case "channels": {
      return m.cards_filter_unit_channels();
    }
    case "customTags": {
      return m.cards_filter_unit_custom_tags();
    }
    case "tags": {
      return m.cards_filter_unit_tags();
    }
    case "keywords": {
      return m.cards_filter_unit_keywords();
    }
    case "banned": {
      return m.cards_filter_unit_banned();
    }
    case "errata": {
      return m.cards_filter_unit_errata();
    }
    case "noImage": {
      return m.cards_filter_unit_no_image();
    }
    case "owned": {
      return m.cards_filter_unit_owned();
    }
    case "price": {
      return m.cards_filter_unit_price();
    }
    default: {
      return key;
    }
  }
}

const UNIT_KEYS = new Set(FILTER_PLACEMENT_UNITS.map((unit) => unit.key));

export const DEFAULT_TOP_LEVEL_UNITS: ReadonlySet<string> = new Set(
  PREFERENCE_DEFAULTS.topLevelFilters,
);

export function keepPlacementUnits(keys: Iterable<string>): string[] {
  return [...new Set(keys)].filter((key) => UNIT_KEYS.has(key));
}

export function resolveTopLevelUnits(topLevelFilters: Iterable<string>): ReadonlySet<string> {
  return new Set(keepPlacementUnits(topLevelFilters));
}

interface ApplicabilityInput extends FilterDimensionAvailability {
  surfaceHiddenSections?: ReadonlySet<string>;
}

function sectionApplies(section: string, input: ApplicabilityInput): boolean {
  return !input.surfaceHiddenSections?.has(section) && sectionHasContent(section, input);
}

export function getApplicablePlacementUnits(input: ApplicabilityInput): FilterPlacementUnit[] {
  return FILTER_PLACEMENT_UNITS.filter((unit) =>
    unit.sections.some((section) => sectionApplies(section, input)),
  );
}
