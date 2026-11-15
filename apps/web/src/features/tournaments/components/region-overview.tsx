import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import type { PodStandingRow } from "@openrift/shared/types/api/pod-tournament";

import { ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { SectionHeading } from "@/components/ui/section-heading";
import { useRegionLabel } from "@/features/tournaments/hooks/use-region-label";
import type { RegionOverview as RegionOverviewData } from "@/features/tournaments/lib/region-overview";
import { computeRegionOverview } from "@/features/tournaments/lib/region-overview";
import { formatScore } from "@/features/tournaments/lib/standings-display";
import { m } from "@/paraglide/messages.js";

// A zero leading average leaves every track empty.
function barPercent(avgScore: number, topAvgScore: number): number {
  if (topAvgScore <= 0) {
    return 0;
  }
  return Math.max(0, (avgScore / topAvgScore) * 100);
}

function RegionRow({
  row,
  topAvgScore,
}: {
  row: RegionOverviewData["rows"][number];
  topAvgScore: number;
}) {
  const regionLabel = useRegionLabel();
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate font-medium">{regionLabel(row.region)}</span>
        <span className="text-muted-foreground shrink-0 text-sm">
          <span className="text-foreground font-semibold tabular-nums">
            {formatScore(row.avgScore)}
          </span>{" "}
          {m.tournaments_region_overview_avg_players({ count: row.playerCount })}
        </span>
      </div>
      <ProgressPrimitive.Root
        value={barPercent(row.avgScore, topAvgScore)}
        aria-label={regionLabel(row.region)}
      >
        <ProgressTrack className="h-1.5">
          <ProgressIndicator className="bg-border-accent rounded-full" />
        </ProgressTrack>
      </ProgressPrimitive.Root>
    </li>
  );
}

export function RegionOverview({ standings }: { standings: PodStandingRow[] }) {
  const { rows, unassignedCount } = computeRegionOverview(standings);
  const [leadingRow] = rows;
  if (leadingRow === undefined) {
    return null;
  }
  const topAvgScore = leadingRow.avgScore;
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading as="h3" count={rows.length}>
        {m.tournaments_region_overview_heading()}
      </SectionHeading>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <RegionRow key={row.region} row={row} topAvgScore={topAvgScore} />
        ))}
      </ul>
      {unassignedCount > 0 ? (
        <p className="text-muted-foreground text-sm">
          {m.tournaments_region_overview_unassigned({ count: unassignedCount })}
        </p>
      ) : null}
    </section>
  );
}
