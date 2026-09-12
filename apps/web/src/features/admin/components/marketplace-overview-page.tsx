import { priceRefreshResponseSchema } from "@openrift/shared/contracts/admin/job-results";
import { formatRelativeTime } from "@openrift/shared/format-date";
import type { PriceRefreshResponse } from "@openrift/shared/types/api/admin";
import { CheckIcon, LoaderIcon, XIcon } from "lucide-react";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { refreshActions } from "@/features/admin/hooks/refresh-actions";
import {
  useClearPrices,
  useLatestJobRun,
  useRefreshPrices,
} from "@/features/admin/hooks/use-admin-prices";
import { useJobSchedules } from "@/features/admin/hooks/use-job-schedules";
import { useMarketplaceGroups } from "@/features/admin/hooks/use-marketplace-groups";
import {
  SIBLING_VARIANT_BACKFILL_KIND,
  useBackfillSiblingVariants,
  useSiblingVariantDrift,
} from "@/features/admin/hooks/use-sibling-variants";
import type { JobRunView } from "@/lib/server-fns/api-types";

import { ConfirmClearButton } from "./confirm-clear-button";

// Old `job_runs.result` rows predate the per-SKU prices reshape and lack `upserted.prices`.
export function isPriceRefreshResult(value: unknown): value is PriceRefreshResponse {
  return priceRefreshResponseSchema.safeParse(value).success;
}

function PriceRefreshResult({ result }: { result: PriceRefreshResponse }) {
  const { transformed, upserted } = result;
  return (
    <div className="text-muted-foreground space-y-0.5">
      <p className="text-muted-foreground flex items-center gap-1 text-sm">
        <CheckIcon className="text-success size-4 shrink-0" />
        Fetched {transformed.groups} groups, {transformed.products} products, {transformed.prices}{" "}
        prices
      </p>
      {upserted.prices.new > 0 && <p>Inserted: {upserted.prices.new} prices</p>}
      {upserted.prices.updated > 0 && <p>Updated: {upserted.prices.updated} prices</p>}
    </div>
  );
}

function JobRunDisplay({
  run,
  failedText = "Refresh failed",
  succeededText = "Completed",
}: {
  run: JobRunView;
  failedText?: string;
  succeededText?: string;
}) {
  if (run.status === "running") {
    return (
      <p className="text-muted-foreground flex items-center gap-1 text-sm">
        <LoaderIcon className="size-4 animate-spin" />
        Started {formatRelativeTime(run.startedAt)}
      </p>
    );
  }
  if (run.status === "failed") {
    return (
      <p className="text-muted-foreground flex items-center gap-1 text-sm">
        <XIcon className="text-destructive size-4 shrink-0" />
        {run.errorMessage ?? failedText}
      </p>
    );
  }
  if (isPriceRefreshResult(run.result)) {
    return <PriceRefreshResult result={run.result} />;
  }
  return (
    <p className="text-muted-foreground flex items-center gap-1 text-sm">
      <CheckIcon className="text-success size-4 shrink-0" />
      {succeededText}
    </p>
  );
}

function PriceSection({
  label,
  groups,
  mapped,
  staged,
  marketplace,
  nextRun,
}: {
  label: "TCGplayer" | "Cardmarket" | "CardTrader";
  groups: number;
  mapped: number;
  staged: number;
  marketplace: "tcgplayer" | "cardmarket" | "cardtrader";
  nextRun: string | null;
}) {
  const refreshMutation = useRefreshPrices(marketplace);
  const clearMutation = useClearPrices(marketplace);
  const latestRun = useLatestJobRun(refreshActions[marketplace].jobKind);

  const isRefreshRunning = refreshMutation.isPending || latestRun.data?.status === "running";
  const anyPending = isRefreshRunning || clearMutation.isPending;

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
          <ConfirmClearButton
            title={`Clear all ${label} price data?`}
            description="This will delete all price sources, snapshots, and staging data. Prices will be repopulated on the next refresh."
            onConfirm={() => clearMutation.mutate()}
            disabled={anyPending}
            isPending={clearMutation.isPending}
          />
          <Button
            disabled={anyPending}
            onClick={() =>
              refreshMutation.mutate(undefined, {
                onSuccess: () => void latestRun.refetch(),
              })
            }
          >
            {isRefreshRunning ? <LoaderIcon className="size-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>
      }
    >
      {latestRun.data && <JobRunDisplay run={latestRun.data} />}
      {refreshMutation.isError && (
        <p className="text-muted-foreground flex items-center gap-1 text-sm">
          <XIcon className="text-destructive size-4 shrink-0" />
          {refreshMutation.error.message}
        </p>
      )}
      {clearMutation.isSuccess && (
        <p className="text-muted-foreground flex items-center gap-1 text-sm">
          <CheckIcon className="text-success size-4 shrink-0" />
          Cleared {clearMutation.data.deleted.products} products,{" "}
          {clearMutation.data.deleted.variants} variants, {clearMutation.data.deleted.prices} prices
        </p>
      )}
      {clearMutation.isError && (
        <p className="text-muted-foreground flex items-center gap-1 text-sm">
          <XIcon className="text-destructive size-4 shrink-0" />
          {clearMutation.error.message}
        </p>
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
  const backfill = useBackfillSiblingVariants();
  const latestRun = useLatestJobRun(SIBLING_VARIANT_BACKFILL_KIND);
  const isRunning = backfill.isPending || latestRun.data?.status === "running";
  const drift = useSiblingVariantDrift(isRunning);

  return (
    <SettingsSection
      title="Language Fan-out"
      description={driftText(drift.data?.missing, drift.isError)}
      action={
        <Button
          className="shrink-0"
          disabled={isRunning}
          onClick={() =>
            backfill.mutate(undefined, {
              onSuccess: () => void latestRun.refetch(),
            })
          }
        >
          {isRunning ? <LoaderIcon className="size-4 animate-spin" /> : "Backfill"}
        </Button>
      }
    >
      {latestRun.data && (
        <JobRunDisplay
          run={latestRun.data}
          failedText="Backfill failed"
          succeededText={backfillSucceededText(latestRun.data.result)}
        />
      )}
      {backfill.isError && (
        <p className="text-muted-foreground flex items-center gap-1 text-sm">
          <XIcon className="text-destructive size-4 shrink-0" />
          {backfill.error.message}
        </p>
      )}
    </SettingsSection>
  );
}

export function MarketplaceOverviewPage() {
  const { data: schedules } = useJobSchedules();
  const { data: groupsData } = useMarketplaceGroups();

  const nextRunByKind = new Map(schedules.jobs.map((job) => [job.kind, job.nextRun]));

  const allGroups = groupsData.groups;
  const tcgGroups = allGroups.filter((g) => g.marketplace === "tcgplayer");
  const cmGroups = allGroups.filter((g) => g.marketplace === "cardmarket");
  const ctGroups = allGroups.filter((g) => g.marketplace === "cardtrader");
  const tcgAssigned = tcgGroups.reduce((sum, g) => sum + g.assignedCount, 0);
  const tcgStaged = tcgGroups.reduce((sum, g) => sum + g.stagedCount, 0);
  const cmAssigned = cmGroups.reduce((sum, g) => sum + g.assignedCount, 0);
  const cmStaged = cmGroups.reduce((sum, g) => sum + g.stagedCount, 0);
  const ctAssigned = ctGroups.reduce((sum, g) => sum + g.assignedCount, 0);
  const ctStaged = ctGroups.reduce((sum, g) => sum + g.stagedCount, 0);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageTopBar title="Marketplace Overview" />
      <PriceSection
        label="TCGplayer"
        groups={tcgGroups.length}
        mapped={tcgAssigned}
        staged={tcgStaged}
        marketplace="tcgplayer"
        nextRun={nextRunByKind.get("tcgplayer.refresh") ?? null}
      />
      <PriceSection
        label="Cardmarket"
        groups={cmGroups.length}
        mapped={cmAssigned}
        staged={cmStaged}
        marketplace="cardmarket"
        nextRun={nextRunByKind.get("cardmarket.refresh") ?? null}
      />
      <PriceSection
        label="CardTrader"
        groups={ctGroups.length}
        mapped={ctAssigned}
        staged={ctStaged}
        marketplace="cardtrader"
        nextRun={nextRunByKind.get("cardtrader.refresh") ?? null}
      />
      <SiblingVariantSection />
    </div>
  );
}
