import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import type { CompletionScopePreference } from "@openrift/shared/types/api/preferences";
import type { Domain } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";

import { Empty, EmptyDescription } from "@/components/ui/empty";
import { ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { SectionHeading } from "@/components/ui/section-heading";
import { FilterIcon } from "@/features/cards/components/filter-icon";
import type { FilterSearch } from "@/features/cards/lib/search-schemas";
import type {
  CollectionStatsResult,
  CompletionEntry,
} from "@/features/collections/hooks/use-collection-stats";
import {
  computeCompletion,
  filterByScope,
} from "@/features/collections/hooks/use-collection-stats";
import { formatCompletionPercent } from "@/features/collections/lib/completion-percent";
import { omitZeroCompletion } from "@/features/collections/lib/completion-visibility";
import type { CompletionCountMode, CompletionGroupBy } from "@/features/collections/lib/stat-types";
import { buildMissingSearch } from "@/features/collections/lib/stats-missing-search";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { useEnumOrders } from "@/hooks/use-enums";
import { getDomainColor } from "@/lib/domain";
import { formatCount } from "@/lib/format";
import type { FilterCategory } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function CompletionTotalRow({ entries }: { entries: CompletionEntry[] }) {
  const totalOwned = entries.reduce((sum, entry) => sum + entry.owned, 0);
  const totalAll = entries.reduce((sum, entry) => sum + entry.total, 0);
  const percent = totalAll > 0 ? (totalOwned / totalAll) * 100 : 0;

  return (
    <div className="mb-4 py-1.5">
      <div className="flex items-center gap-2 text-sm">
        <span className="min-w-0 flex-1 truncate font-semibold">
          {m.collections_stats_completion_overall()}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {formatCount(totalOwned)} / {formatCount(totalAll)}
        </span>
        <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums">
          {formatCompletionPercent(totalOwned, totalAll)}
        </span>
        <span className="w-3.5 shrink-0" />
      </div>
      <ProgressPrimitive.Root value={Math.min(percent, 100)} className="mt-1.5 w-full">
        <ProgressTrack className="h-1.5">
          <ProgressIndicator className="rounded-full" />
        </ProgressTrack>
      </ProgressPrimitive.Root>
    </div>
  );
}

function CompletionRow({
  entry,
  iconCategory,
  barColor,
  missingSearch,
}: {
  entry: CompletionEntry;
  iconCategory?: FilterCategory;
  barColor?: string;
  missingSearch?: Partial<FilterSearch>;
}) {
  const missing = entry.total - entry.owned;

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 font-medium">
          {iconCategory && (
            <FilterIcon category={iconCategory} value={entry.key} className="size-4 shrink-0" />
          )}
          <span className="truncate">{entry.label}</span>
        </span>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {entry.owned} / {entry.total}
        </span>
        <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums">
          {formatCompletionPercent(entry.owned, entry.total, 0)}
        </span>
        {missingSearch ? (
          <Link
            to="/cards"
            search={missingSearch}
            title={m.collections_stats_completion_browse_missing({ count: missing })}
            className={cn(
              "shrink-0",
              missing > 0
                ? "text-muted-foreground hover:text-foreground"
                : "pointer-events-none invisible",
            )}
            tabIndex={missing > 0 ? undefined : -1}
          >
            <ExternalLinkIcon className="size-3.5" />
          </Link>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
      </div>
      <div className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-all", !barColor && "bg-primary")}
          style={{
            width: `${Math.min(entry.percent, 100)}%`,
            ...(barColor ? { backgroundColor: barColor } : {}),
          }}
        />
      </div>
    </div>
  );
}

const ROW_ICON_CATEGORY: Partial<Record<CompletionGroupBy, FilterCategory>> = {
  domain: "domains",
  rarity: "rarities",
  type: "types",
};

export function CompletionSection({
  stats,
  groupBy,
  countMode,
  scope,
}: {
  stats: CollectionStatsResult;
  groupBy: CompletionGroupBy;
  countMode: CompletionCountMode;
  scope: CompletionScopePreference;
}) {
  const domainColors = useDomainColors();
  const { rarityColors, labels } = useEnumOrders();

  const scopedPrintings = filterByScope(stats.allPrintings, scope, stats.customTagAssignments);

  const entries = computeCompletion({
    stacks: stats.stacks,
    scopedPrintings,
    scope,
    customTagAssignments: stats.customTagAssignments,
    sets: stats.sets,
    groupBy,
    countMode,
    orders: stats.orders,
    labels: {
      domains: labels.domains,
      rarities: labels.rarities,
      cardTypes: labels.cardTypes,
    },
  });

  const visibleEntries = omitZeroCompletion(entries);
  const mainEntries =
    groupBy === "set"
      ? visibleEntries.filter((entry) => entry.setType === WellKnown.setType.MAIN)
      : visibleEntries;
  const supplementalEntries =
    groupBy === "set"
      ? visibleEntries.filter((entry) => entry.setType === WellKnown.setType.SUPPLEMENTAL)
      : [];

  function rowBarColor(key: string): string | undefined {
    if (groupBy === "domain") {
      return getDomainColor(key as Domain, domainColors);
    }
    if (groupBy === "rarity") {
      return rarityColors[key];
    }
    return undefined;
  }

  const setIdToSlug = new Map(stats.sets.map((set) => [set.id, set.slug]));
  const missingSearch = (key: string): Partial<FilterSearch> | undefined =>
    buildMissingSearch({ countMode, groupBy, key, scope, setIdToSlug });

  return (
    <section>
      <CompletionTotalRow entries={entries} />

      {mainEntries.length === 0 && supplementalEntries.length === 0 ? (
        <Empty>
          <EmptyDescription>
            {entries.length === 0
              ? m.collections_stats_completion_no_data()
              : m.collections_stats_completion_all_zero()}
          </EmptyDescription>
        </Empty>
      ) : (
        <>
          <div>
            {mainEntries.map((entry) => (
              <CompletionRow
                key={entry.key}
                entry={entry}
                iconCategory={ROW_ICON_CATEGORY[groupBy]}
                barColor={rowBarColor(entry.key)}
                missingSearch={missingSearch(entry.key)}
              />
            ))}
          </div>
          {supplementalEntries.length > 0 && (
            <div className="mt-8">
              <SectionHeading as="h3" className="mb-2">
                {m.collections_stats_completion_supplemental()}
              </SectionHeading>
              {supplementalEntries.map((entry) => (
                <CompletionRow
                  key={entry.key}
                  entry={entry}
                  iconCategory={ROW_ICON_CATEGORY[groupBy]}
                  barColor={rowBarColor(entry.key)}
                  missingSearch={missingSearch(entry.key)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
