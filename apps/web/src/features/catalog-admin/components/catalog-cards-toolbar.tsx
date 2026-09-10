import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DebouncedSearchInput } from "@/features/admin/components/debounced-search-input";
import { ALL_ASSIGNABLE_SCOPE } from "@/features/cards/lib/marketplace-coverage";
import type {
  CardIssue,
  CardSegment,
  CardsListParams,
  ScopeOption,
} from "@/features/catalog-admin/lib/catalog-card-list";
import {
  ANY_ISSUE,
  CARD_ISSUE_LABELS,
  CARD_ISSUES,
  CARD_SEGMENT_LABELS,
  CARD_SEGMENTS,
} from "@/features/catalog-admin/lib/catalog-card-list";

const ALL_SETS = "all-sets";

export interface CardsToolbarHandlers {
  onSegment: (segment: CardSegment) => void;
  onIssue: (issue: CardIssue | null) => void;
  onScope: (scope: string) => void;
  onSet: (set: string | null) => void;
  onQuery: (q: string) => void;
}

export function CatalogCardsToolbar({
  state,
  counts,
  sets,
  scopeOptions,
  issues,
  visibleCount,
  handlers,
}: {
  state: CardsListParams;
  counts: Record<CardSegment, number>;
  sets: { slug: string; name: string }[];
  scopeOptions: ScopeOption[];
  issues: readonly CardIssue[];
  visibleCount: number;
  handlers: CardsToolbarHandlers;
}) {
  // A shared URL can carry an issue this operator is not offered; dropping it
  // from the items would leave the Select with a value it cannot label.
  const offered =
    state.issue !== undefined && !issues.includes(state.issue) ? [...issues, state.issue] : issues;
  const issueItems = [
    { value: ANY_ISSUE, label: "Any issue" },
    ...offered.map((issue) => ({ value: issue, label: CARD_ISSUE_LABELS[issue] })),
  ];
  const scopeItems = scopeOptions.map((option) => ({
    value: option.value,
    label: `${option.label} (${option.count})`,
  }));

  return (
    <div className="flex flex-wrap items-center gap-3">
      <DebouncedSearchInput
        urlValue={state.q ?? ""}
        placeholder="Search name or code…"
        className="w-64"
        onCommit={(next) => handlers.onQuery(next)}
      />

      <Select
        items={[
          { value: ALL_SETS, label: "All sets" },
          ...sets.map((set) => ({ value: set.slug, label: set.name })),
        ]}
        value={state.set ?? ALL_SETS}
        onValueChange={(value: string | null) => {
          handlers.onSet(value === null || value === ALL_SETS ? null : value);
        }}
      >
        <SelectTrigger className="w-44" aria-label="Set">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SETS}>All sets</SelectItem>
          {sets.map((set) => (
            <SelectItem key={set.slug} value={set.slug}>
              {set.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        value={[state.segment]}
        aria-label="Card segment"
        onValueChange={([next]) => {
          const match = CARD_SEGMENTS.find((option) => option === next);
          if (match) {
            handlers.onSegment(match);
          }
        }}
      >
        {CARD_SEGMENTS.map((option) => (
          <ToggleGroupItem key={option} value={option}>
            {CARD_SEGMENT_LABELS[option]} ({counts[option]})
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Select
        items={issueItems}
        value={state.issue ?? ANY_ISSUE}
        onValueChange={(value: string | null) => {
          const match = CARD_ISSUES.find((option) => option === value);
          handlers.onIssue(match ?? null);
        }}
      >
        <SelectTrigger className="w-52" aria-label="Issue">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {issueItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {state.issue === "unlinked-products" && (
        <Select
          items={scopeItems}
          value={state.scope}
          onValueChange={(value: string | null) => {
            handlers.onScope(value ?? ALL_ASSIGNABLE_SCOPE);
          }}
        >
          <SelectTrigger className="w-56" aria-label="Marketplace scope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scopeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label} ({option.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <p className="text-muted-foreground ml-auto text-sm">
        {visibleCount} card{visibleCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}
