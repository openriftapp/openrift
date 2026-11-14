import type { ReactNode } from "react";

import { FilterCountDrawer } from "@/components/filter-count-drawer";
import { FilterChip } from "@/components/ui/filter-chip";
import { SimpleSelect } from "@/components/ui/simple-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCollections } from "@/features/collections/hooks/use-collections";
import type { CompletionCountMode, CompletionGroupBy } from "@/features/collections/lib/stat-types";
import { useSmUp } from "@/hooks/use-sm-up";
import { m } from "@/paraglide/messages.js";

function groupByOptions(): { value: CompletionGroupBy; label: string }[] {
  return [
    { value: "set", label: m.collections_stats_group_by_set() },
    { value: "domain", label: m.collections_stats_group_by_domain() },
    { value: "rarity", label: m.collections_stats_group_by_rarity() },
    { value: "type", label: m.collections_stats_group_by_type() },
  ];
}

function countModeOptions(): { value: CompletionCountMode; label: string; tooltip: string }[] {
  return [
    {
      value: "cards",
      label: m.collections_stats_count_cards(),
      tooltip: m.collections_stats_count_cards_tooltip(),
    },
    {
      value: "printings",
      label: m.collections_stats_count_printings(),
      tooltip: m.collections_stats_count_printings_tooltip(),
    },
    {
      value: "copies",
      label: m.collections_stats_count_playset(),
      tooltip: m.collections_stats_count_playset_tooltip(),
    },
  ];
}

function CollectionSelector({
  value,
  onChange,
  collections,
}: {
  value: string;
  onChange: (value: string) => void;
  collections: { id: string; name: string }[];
}) {
  return (
    <SimpleSelect
      items={[
        { value: "all", label: m.collections_stats_scope_all() },
        ...collections.map((col) => ({ value: col.id, label: col.name })),
      ]}
      value={value}
      onChange={onChange}
      label={m.collections_stats_scope_label()}
      className="w-auto"
    />
  );
}

function CountModeToggle({
  value,
  onChange,
}: {
  value: CompletionCountMode;
  onChange: (value: CompletionCountMode) => void;
}) {
  const choices = countModeOptions();
  return (
    <TooltipProvider>
      <ToggleGroup
        variant="outline"
        spacing={0}
        value={[value]}
        onValueChange={([next]) => {
          const option = choices.find((entry) => entry.value === next);
          if (option) {
            onChange(option.value);
          }
        }}
        aria-label={m.collections_stats_count_mode_label()}
      >
        {choices.map((option) => (
          <Tooltip key={option.value}>
            <TooltipTrigger render={<ToggleGroupItem value={option.value} />}>
              {option.label}
            </TooltipTrigger>
            <TooltipContent>{option.tooltip}</TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </TooltipProvider>
  );
}

function GroupByToggle({
  value,
  onChange,
  className,
}: {
  value: CompletionGroupBy;
  onChange: (value: CompletionGroupBy) => void;
  className?: string;
}) {
  const choices = groupByOptions();
  return (
    <ToggleGroup
      variant="outline"
      spacing={0}
      value={[value]}
      onValueChange={([next]) => {
        const option = choices.find((entry) => entry.value === next);
        if (option) {
          onChange(option.value);
        }
      }}
      aria-label={m.collections_stats_group_by_label()}
      className={className}
    >
      {choices.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} className="flex-1 sm:flex-none">
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function CollectionStatsToolbar({
  collectionScope,
  onCollectionScopeChange,
  groupBy,
  onGroupByChange,
  countMode,
  onCountModeChange,
  activeCount,
  filters,
}: {
  collectionScope: string;
  onCollectionScopeChange: (value: string) => void;
  groupBy: CompletionGroupBy;
  onGroupByChange: (value: CompletionGroupBy) => void;
  countMode: CompletionCountMode;
  onCountModeChange: (value: CompletionCountMode) => void;
  activeCount: number;
  filters: ReactNode;
}) {
  const smUp = useSmUp();
  const { data: collections } = useCollections();
  const scopedName = collections.find((col) => col.id === collectionScope)?.name;

  const scopeControls = (
    <div className="flex flex-wrap items-center gap-2">
      <CollectionSelector
        value={collectionScope}
        onChange={onCollectionScopeChange}
        collections={collections}
      />
      <CountModeToggle value={countMode} onChange={onCountModeChange} />
    </div>
  );

  if (smUp) {
    return (
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {scopeControls}
          <GroupByToggle value={groupBy} onChange={onGroupByChange} className="ml-auto" />
        </div>
        {filters}
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <FilterCountDrawer
          count={activeCount}
          description={m.collections_stats_filters_description()}
        >
          {scopeControls}
          {filters}
        </FilterCountDrawer>
        {scopedName !== undefined && (
          <FilterChip
            label={scopedName}
            removeLabel={m.cards_filter_clear_named({ label: scopedName })}
            onRemove={() => onCollectionScopeChange("all")}
            className="min-w-0"
          />
        )}
      </div>
      <GroupByToggle value={groupBy} onChange={onGroupByChange} className="w-full" />
    </div>
  );
}
