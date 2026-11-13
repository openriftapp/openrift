import { priceRefreshResponseSchema } from "@openrift/shared/contracts/admin/job-results";
import type { JobRunView } from "@openrift/shared/contracts/admin/job-runs";
import { formatRelativeTime } from "@openrift/shared/format-date";
import { JOB_KIND, PRICE_REFRESH_JOB_KIND } from "@openrift/shared/job-run-kinds";
import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import type { PriceRefreshResponse } from "@openrift/shared/types/api/admin";
import type { Marketplace } from "@openrift/shared/types/pricing";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import {
  JobRunStatusLine,
  JobRunStatusMessage,
} from "@/features/admin/components/job-run-status-line";
import { useClearPrices } from "@/features/admin/hooks/use-admin-prices";
import { useJobSchedules } from "@/features/admin/hooks/use-job-schedules";
import { useMarketplaceGroups } from "@/features/admin/hooks/use-marketplace-groups";
import { useSiblingVariantDrift } from "@/features/admin/hooks/use-sibling-variants";
import { useStartJob } from "@/features/admin/hooks/use-start-job";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";

// Old `job_runs.result` rows predate the per-SKU prices reshape and lack `upserted.prices`.
export function isPriceRefreshResult(value: unknown): value is PriceRefreshResponse {
  return priceRefreshResponseSchema.safeParse(value).success;
}

function PriceRefreshResult({ result }: { result: PriceRefreshResponse }) {
  const { transformed, upserted } = result;
  return (
    <div className="text-muted-foreground space-y-0.5">
      <JobRunStatusMessage status="succeeded">
        Fetched {transformed.groups} groups, {transformed.products} products, {transformed.prices}{" "}
        prices
      </JobRunStatusMessage>
      {upserted.prices.new > 0 && <p>Inserted: {upserted.prices.new} prices</p>}
      {upserted.prices.updated > 0 && <p>Updated: {upserted.prices.updated} prices</p>}
    </div>
  );
}

function PriceSection({
  groups,
  mapped,
  staged,
  marketplace,
  nextRun,
}: {
  groups: number;
  mapped: number;
  staged: number;
  marketplace: Marketplace;
  nextRun: string | null;
}) {
  const { label } = MARKETPLACE_LINKS[marketplace];
  const refresh = useStartJob(PRICE_REFRESH_JOB_KIND[marketplace], `${label} price refresh`);
  const clearMutation = useClearPrices(marketplace);
  const anyPending = refresh.running || clearMutation.isPending;

  return (
    <SettingsSection
      title={`${label} Prices`}
      description={
        <>
          {groups} groups · {mapped} mapped · {staged} staged
          {nextRun && ` · next refresh ${formatRelativeTime(nextRun, { compound: true })}`}
        </>
      }
      action={
        <div className="flex shrink-0 gap-2">
          <ConfirmActionButton
            trigger={<Button variant="destructive" pending={clearMutation.isPending} />}
            disabled={anyPending}
            title={`Clear all ${label} price data?`}
            description="This will delete all price sources, snapshots, and staging data. Prices will be repopulated on the next refresh."
            confirmLabel="Clear"
            pendingLabel="Clearing…"
            onConfirm={() => clearMutation.mutateAsync()}
          >
            Clear
          </ConfirmActionButton>
          <Button
            disabled={anyPending}
            pending={refresh.running}
            onClick={() => void refresh.start()}
          >
            Refresh
          </Button>
        </div>
      }
    >
      {refresh.latestRun && (
        <JobRunStatusLine
          run={refresh.latestRun}
          failedText="Refresh failed"
          renderSucceeded={(run) =>
            isPriceRefreshResult(run.result) ? (
              <PriceRefreshResult result={run.result} />
            ) : (
              <JobRunStatusMessage status="succeeded">Completed</JobRunStatusMessage>
            )
          }
        />
      )}
      {clearMutation.isSuccess && (
        <JobRunStatusMessage status="succeeded">
          Cleared {clearMutation.data.deleted.products} products,{" "}
          {clearMutation.data.deleted.variants} variants, {clearMutation.data.deleted.prices} prices
        </JobRunStatusMessage>
      )}
    </SettingsSection>
  );
}

export function driftText(missing: number | undefined, isError: boolean): string {
  if (isError) {
    return "Could not read how many printings are missing a price link.";
  }
  if (missing === undefined) {
    return "Checking for printings without a price link…";
  }
  if (missing === 0) {
    return "Every printing in a mapped family has its own price link.";
  }
  return `${missing} printings sit in a mapped family with no price link of their own.`;
}

export function backfillSucceededText(result: JobRunView["result"]): string {
  const inserted = result?.inserted;
  if (typeof inserted !== "number") {
    return "Completed";
  }
  return inserted === 0 ? "Nothing to add" : `Added ${inserted} sibling variants`;
}

/**
 * Cardmarket and TCGplayer price one product across every language of a
 * printing family, so each covered printing carries its own variant row.
 */
function SiblingVariantSection() {
  const backfill = useStartJob(JOB_KIND.backfillSiblingVariants, "Language fan-out backfill", {
    invalidates: [adminKeys.siblingVariantDrift],
  });
  const drift = useSiblingVariantDrift(backfill.running);

  return (
    <SettingsSection
      title="Language Fan-out"
      description={driftText(drift.data?.missing, drift.isError)}
      action={
        <Button
          className="shrink-0"
          pending={backfill.running}
          onClick={() => void backfill.start()}
        >
          Backfill
        </Button>
      }
    >
      {backfill.latestRun && (
        <JobRunStatusLine
          run={backfill.latestRun}
          failedText="Backfill failed"
          succeededText={backfillSucceededText(backfill.latestRun.result)}
        />
      )}
    </SettingsSection>
  );
}

export function MarketplaceOverviewPage() {
  const { data: schedules } = useJobSchedules();
  const { data: groupsData } = useMarketplaceGroups();

  const nextRunByKind = new Map(schedules.jobs.map((job) => [job.kind, job.nextRun]));

  const marketplaces = Object.keys(MARKETPLACE_LINKS) as Marketplace[];

  return (
    <div className="flex flex-col gap-8">
      <AdminPageTopBar title="Marketplace Overview" />
      {marketplaces.map((marketplace) => {
        const groups = groupsData.groups.filter((group) => group.marketplace === marketplace);
        return (
          <PriceSection
            key={marketplace}
            groups={groups.length}
            mapped={groups.reduce((sum, group) => sum + group.assignedCount, 0)}
            staged={groups.reduce((sum, group) => sum + group.stagedCount, 0)}
            marketplace={marketplace}
            nextRun={nextRunByKind.get(PRICE_REFRESH_JOB_KIND[marketplace]) ?? null}
          />
        );
      })}
      <SiblingVariantSection />
    </div>
  );
}
