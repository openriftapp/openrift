import type { JobRunView } from "@openrift/shared/contracts/admin/job-runs";
import { JOB_KIND } from "@openrift/shared/job-run-kinds";
import { EraserIcon, RefreshCwIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { SettingsSection } from "@/components/layout/settings-section";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { JobRunStatusLine } from "@/features/admin/components/job-run-status-line";
import { useCacheStatus, usePurgeCache } from "@/features/admin/hooks/use-cache-purge";
import { useStartJob } from "@/features/admin/hooks/use-start-job";
import { useClearSsrCache } from "@/features/admin/hooks/use-status";

/**
 * Succeeded-line text for the card-token job: the counts its run summary
 * recorded, or a plain "Completed" for runs without one.
 */
function cardTokensSucceededText(result: JobRunView["result"]): string {
  const totalCards = result?.totalCards;
  const withTokens = result?.withTokens;
  if (typeof totalCards === "number" && typeof withTokens === "number") {
    return `${withTokens} of ${totalCards} cards reference at least one token`;
  }
  return "Completed";
}

export function CachePage() {
  const { data } = useCacheStatus();
  const purge = usePurgeCache();
  const clearSsrCache = useClearSsrCache();
  const matviews = useStartJob(JOB_KIND.refreshMatviews, "Materialized view refresh");
  const cardTokens = useStartJob(JOB_KIND.recomputeCardTokens, "Card token pass");

  return (
    <div className="flex flex-col gap-8">
      <AdminPageTopBar title="Cache" />
      <SettingsSection
        title="SSR Cache"
        description="Clears the in-memory query cache the SSR layer uses to deduplicate API calls during a single render. Use this when you've fixed bad data on the API and want server-rendered pages to pick up the change immediately instead of waiting for the cache TTL."
      >
        <div>
          <Button
            variant="outline"
            onClick={() => clearSsrCache.mutate()}
            pending={clearSsrCache.isPending}
          >
            <EraserIcon className="size-4" />
            {clearSsrCache.isSuccess ? "Cache Cleared" : "Clear SSR Cache"}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Materialized Views"
        description="Rebuilds the latest-prices and card-aggregates materialized views in Postgres. Cron normally keeps these in sync, but you can refresh them on demand after a manual price import or a fix that would otherwise leave stale aggregates around."
      >
        <div>
          <Button
            variant="outline"
            onClick={() => void matviews.start()}
            pending={matviews.running}
          >
            <RefreshCwIcon className="size-4" />
            Refresh materialized views
          </Button>
        </div>
        {matviews.latestRun && (
          <JobRunStatusLine run={matviews.latestRun} succeededText="Materialized views refreshed" />
        )}
      </SettingsSection>

      <SettingsSection
        title="Card Tokens"
        description="Re-reads every card's English rules text and rebuilds the list of tokens each one tells the player to create, which is what the deck pages show under Tokens. Card and errata edits already update the card they touch, so this is for the first backfill and after a bulk set import. Manually corrected entries are left alone."
      >
        <div>
          <Button
            variant="outline"
            onClick={() => void cardTokens.start()}
            pending={cardTokens.running}
          >
            <RefreshCwIcon className="size-4" />
            Re-derive card tokens
          </Button>
        </div>
        {cardTokens.latestRun && (
          <JobRunStatusLine
            run={cardTokens.latestRun}
            succeededText={cardTokensSucceededText(cardTokens.latestRun.result)}
          />
        )}
      </SettingsSection>

      <SettingsSection
        title="Cloudflare Cache"
        description="Purges everything cached by Cloudflare for this zone (HTML pages, API responses, images). Use this after deploying changes that affect cached URLs, or when fixing bad data that visitors may still see. The next request for each URL will re-fetch from the origin."
      >
        <div>
          {data.configured ? (
            <ConfirmActionButton
              title="Purge all Cloudflare cache?"
              description="Every cached URL for this zone will be evicted. The next visitor to each page will briefly see a slower response while the cache warms up again."
              confirmLabel="Purge"
              onConfirm={async () => {
                await purge.mutateAsync();
                toast.success("Cloudflare cache purged");
              }}
              trigger={<Button variant="destructive" />}
            >
              <TrashIcon className="size-4" />
              Purge Cloudflare cache
            </ConfirmActionButton>
          ) : (
            <Alert variant="warning">
              <AlertDescription>
                Cloudflare cache purging is not configured. Set <Code>CLOUDFLARE_API_TOKEN</Code>{" "}
                and <Code>CLOUDFLARE_ZONE_ID</Code> in the API environment to enable this button.
                The token needs the <strong>Zone.Cache Purge</strong> permission scoped to your
                zone.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
