import { useState } from "react";

import { MultiSelectCombobox } from "@/components/multi-select-combobox";
import { SearchInput } from "@/components/search-input";
import { AdminFilterSelect, AdminFilterSwitch } from "@/features/admin/components/admin-filters";
import {
  DemoGroup,
  DemoRow,
  DemoSection,
  Swatch,
  SwatchRow,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { SearchQueryFeedback } from "@/features/cards/components/search-query-feedback";

const GROUPS = {
  searchInput: { id: "search-search-input", title: "SearchInput" },
  multiSelect: { id: "search-multi-select", title: "MultiSelectCombobox" },
  adminFilters: { id: "search-admin-filters", title: "Admin filters" },
} as const;

export const SEARCH_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

const DEMO_VOCABULARY = { domain: ["fury", "calm", "mind", "body", "chaos", "order"] };

const REGION_OPTIONS = [
  { value: "piltover", label: "Piltover" },
  { value: "zaun", label: "Zaun" },
  { value: "ionia", label: "Ionia" },
  { value: "noxus", label: "Noxus" },
  { value: "demacia", label: "Demacia" },
];

export function SearchSection() {
  const [plainSearch, setPlainSearch] = useState("");
  const [prefixedSearch, setPrefixedSearch] = useState("t:unit d:fury e<=3");
  const [regions, setRegions] = useState<string[]>(["piltover"]);
  const [excludedRegions, setExcludedRegions] = useState<string[]>(["zaun"]);
  const [demoTriage, setDemoTriage] = useState("any");
  const [demoStatus, setDemoStatus] = useState("any");
  const [demoDecklists, setDemoDecklists] = useState(true);
  const [demoMissing, setDemoMissing] = useState(false);

  return (
    <DemoSection
      id="search"
      title="Search & filters"
      note="The search row and the filter controls that narrow the list below it."
    >
      <DemoGroup
        {...GROUPS.searchInput}
        hint="Keyed clauses show as plain-word chips under the field."
      >
        <SwatchRow label="Leading slot">
          <Swatch label="plain">
            <SearchInput
              value={plainSearch}
              onValueChange={setPlainSearch}
              placeholder="Search decks…"
              className="w-56"
            />
          </Swatch>
          <Swatch label="query chips">
            <div className="w-80">
              <SearchInput
                value={prefixedSearch}
                onValueChange={setPrefixedSearch}
                placeholder="Search cards…"
                trailing="3 / 40 cards"
              />
              <SearchQueryFeedback
                query={prefixedSearch}
                vocabulary={DEMO_VOCABULARY}
                valueLabel={(_key, value) => value}
              />
            </div>
          </Swatch>
        </SwatchRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.multiSelect}
        hint="The chip trigger cycles include, exclude and off, while the button trigger only includes."
      >
        <SwatchRow label="Triggers">
          <Swatch label="button">
            <MultiSelectCombobox
              label="Region"
              options={REGION_OPTIONS}
              selected={regions}
              onChange={setRegions}
              searchPlaceholder="Search regions…"
              triggerStyle="button"
            />
          </Swatch>
          <Swatch label="chip">
            <MultiSelectCombobox
              label="Region"
              options={REGION_OPTIONS}
              selected={regions}
              excluded={excludedRegions}
              onCycle={(value) => {
                if (regions.includes(value)) {
                  setRegions((prev) => prev.filter((v) => v !== value));
                  setExcludedRegions((prev) => [...prev, value]);
                } else if (excludedRegions.includes(value)) {
                  setExcludedRegions((prev) => prev.filter((v) => v !== value));
                } else {
                  setRegions((prev) => [...prev, value]);
                }
              }}
              searchPlaceholder="Search regions…"
              triggerStyle="chip"
            />
          </Swatch>
        </SwatchRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.adminFilters}
        hint="The first option of a select is that filter's off state."
      >
        <DemoRow label="Filter row above a server-paged table">
          <div className="flex w-full flex-wrap items-center gap-2">
            <AdminFilterSelect
              value={demoTriage}
              onChange={setDemoTriage}
              label="Triage state"
              className="w-44"
              options={[
                { value: "any", label: "Any state" },
                { value: "new", label: "New (128)" },
                { value: "accepted", label: "Accepted (12)" },
                { value: "dismissed", label: "Dismissed (4)" },
              ]}
            />
            <AdminFilterSelect
              value={demoStatus}
              onChange={setDemoStatus}
              label="Event status"
              className="w-40"
              options={[
                { value: "any", label: "Any status" },
                { value: "upcoming", label: "Upcoming" },
                { value: "complete", label: "Complete" },
              ]}
            />
            <AdminFilterSwitch
              id="design-filter-decklists"
              checked={demoDecklists}
              onChange={setDemoDecklists}
            >
              Decklists published
            </AdminFilterSwitch>
            <AdminFilterSwitch
              id="design-filter-missing"
              checked={demoMissing}
              onChange={setDemoMissing}
            >
              Gone from the listing
            </AdminFilterSwitch>
          </div>
        </DemoRow>
      </DemoGroup>
    </DemoSection>
  );
}
