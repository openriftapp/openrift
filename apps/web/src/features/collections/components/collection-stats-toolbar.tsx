import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCollections } from "@/features/collections/hooks/use-collections";
import type { CompletionCountMode, CompletionGroupBy } from "@/features/collections/lib/stat-types";
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
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: collections } = useCollections();

  return (
    <Select
      value={value}
      onValueChange={(newValue) => onChange(newValue ?? "all")}
      items={{
        all: m.collections_stats_scope_all(),
        ...Object.fromEntries(collections?.map((col) => [col.id, col.name]) ?? []),
      }}
    >
      <SelectTrigger className="w-auto" aria-label={m.collections_stats_scope_label()}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{m.collections_stats_scope_all()}</SelectItem>
        {collections?.map((col) => (
          <SelectItem key={col.id} value={col.id}>
            {col.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CollectionStatsToolbar({
  collectionScope,
  onCollectionScopeChange,
  groupBy,
  onGroupByChange,
  countMode,
  onCountModeChange,
}: {
  collectionScope: string;
  onCollectionScopeChange: (value: string) => void;
  groupBy: CompletionGroupBy;
  onGroupByChange: (value: CompletionGroupBy) => void;
  countMode: CompletionCountMode;
  onCountModeChange: (value: CompletionCountMode) => void;
}) {
  const groupByChoices = groupByOptions();
  const countModeChoices = countModeOptions();

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <CollectionSelector value={collectionScope} onChange={onCollectionScopeChange} />
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[groupBy]}
          onValueChange={([next]) => {
            const option = groupByChoices.find((entry) => entry.value === next);
            if (option) {
              onGroupByChange(option.value);
            }
          }}
          aria-label={m.collections_stats_group_by_label()}
        >
          {groupByChoices.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <TooltipProvider>
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[countMode]}
            onValueChange={([next]) => {
              const option = countModeChoices.find((entry) => entry.value === next);
              if (option) {
                onCountModeChange(option.value);
              }
            }}
            aria-label={m.collections_stats_count_mode_label()}
          >
            {countModeChoices.map((option) => (
              <Tooltip key={option.value}>
                <TooltipTrigger render={<ToggleGroupItem value={option.value} />}>
                  {option.label}
                </TooltipTrigger>
                <TooltipContent>{option.tooltip}</TooltipContent>
              </Tooltip>
            ))}
          </ToggleGroup>
        </TooltipProvider>
      </div>
    </div>
  );
}
