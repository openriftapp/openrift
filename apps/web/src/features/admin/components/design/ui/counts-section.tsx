import { LayersIcon, SquareIcon } from "lucide-react";
import { useState } from "react";

import { CountWithTotal } from "@/components/ui/count-pill";
import { FilterChip } from "@/components/ui/filter-chip";
import { InlineCountStepper } from "@/components/ui/inline-count-stepper";
import { StatFigure } from "@/components/ui/stat-figure";
import {
  Demo,
  DemoGrid,
  DemoGroup,
  DemoRow,
  DemoSection,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { FilterIcon } from "@/features/cards/components/filter-icon";
import { useShiftHeld } from "@/hooks/use-shift-held";

const GROUPS = {
  stepper: { id: "counts-stepper", title: "InlineCountStepper" },
  figure: { id: "counts-figure", title: "StatFigure" },
  total: { id: "counts-total", title: "CountWithTotal" },
  filterChip: { id: "counts-filter-chip", title: "FilterChip" },
} as const;

export const COUNTS_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

export function CountsSection() {
  const [count, setCount] = useState(2);
  const shiftHeld = useShiftHeld();
  const [chips, setChips] = useState(["fury", "calm"]);

  return (
    <DemoSection
      id="counts"
      title="Counts, figures & filter chips"
      note="Numbers a row acts on, numbers a page shows off, and the chips an active filter leaves behind."
      docs="components/ui/inline-count-stepper.tsx · stat-figure.tsx · count-pill.tsx · filter-chip.tsx"
    >
      <DemoGroup
        {...GROUPS.stepper}
        hint="Each button fires an action on a row or tile. A dialog picking a bounded number uses QuantityStepper. Hold Shift for the bulk labels."
      >
        <DemoGrid>
          <Demo name='size="sm"' hint="Table rows and card strips.">
            <InlineCountStepper
              count={count}
              decrementLabel="Remove a copy"
              incrementLabel="Add a copy"
              onDecrement={count > 0 ? () => setCount(count - 1) : undefined}
              onIncrement={() => setCount(count + 1)}
              bulk={shiftHeld}
              bulkDecrementLabel={`-${count}`}
              decrementTooltip="Shift-click removes all"
            />
          </Demo>
          <Demo name='size="xs" variant="outline"' hint="Dense deck rows.">
            <InlineCountStepper
              size="xs"
              variant="outline"
              count={`${count}×`}
              decrementLabel="Remove a copy"
              incrementLabel="Add a copy"
              onDecrement={count > 0 ? () => setCount(count - 1) : undefined}
              onIncrement={() => setCount(count + 1)}
              bulk={shiftHeld}
              bulkDecrementLabel={`-${count}`}
              bulkIncrementLabel="+3"
            />
          </Demo>
        </DemoGrid>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.figure}
        hint="One unboxed number with its label underneath. A row of small counts is StatStrip; a number that links is StatTile."
      >
        <DemoRow label="Sizes" className="items-end gap-x-10 gap-y-5">
          <StatFigure value="1,284" label="Decks archived" />
          <StatFigure size="hero" value="3,921" label="Unique cards" icon={SquareIcon} />
          <StatFigure size="hero" value="12,450" label="Copies" icon={LayersIcon}>
            <span className="text-muted-foreground text-xs">+38 this week</span>
          </StatFigure>
        </DemoRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.total}
        hint="A count for the shown printing with the total across its siblings in parentheses when it differs."
      >
        <DemoRow label="Values">
          <span className="text-sm tabular-nums">
            <CountWithTotal count={0} totalCount={2} />
          </span>
          <span className="text-sm tabular-nums">
            <CountWithTotal count={3} totalCount={3} />
          </span>
        </DemoRow>
      </DemoGroup>

      <DemoGroup {...GROUPS.filterChip} hint="One active filter value with its remove button.">
        <DemoRow label="Included and excluded">
          {chips.map((domain) => (
            <FilterChip
              key={domain}
              label={domain === "fury" ? "Fury" : "Calm"}
              icon={<FilterIcon category="domains" value={domain} />}
              onRemove={() => setChips(chips.filter((chip) => chip !== domain))}
              removeLabel={`Remove Domain: ${domain}`}
            />
          ))}
          <FilterChip
            label="Champion"
            icon={<FilterIcon category="superTypes" value="champion" />}
            excluded
            onRemove={() => setChips(["fury", "calm"])}
            removeLabel="Remove excluded Champion"
          />
        </DemoRow>
      </DemoGroup>
    </DemoSection>
  );
}
