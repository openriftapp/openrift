import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import type { JobRunView } from "@openrift/shared/contracts/admin/job-runs";
import { CheckIcon, EraserIcon, LoaderIcon, RefreshCwIcon, TrashIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { SettingsSection } from "@/components/layout/settings-section";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import { DialogForm } from "@/components/ui/dialog-form";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { useCacheStatus, usePurgeCache } from "@/features/admin/hooks/use-cache-purge";
import { useLatestJobRunByKind } from "@/features/admin/hooks/use-job-runs";
import {
  CARD_TOKENS_RECOMPUTE_KIND,
  useRecomputeCardTokens,
} from "@/features/admin/hooks/use-recompute-card-tokens";
import {
  MATVIEWS_REFRESH_KIND,
  useRefreshMatviews,
} from "@/features/admin/hooks/use-refresh-matviews";
import { useClearSsrCache } from "@/features/admin/hooks/use-status";

/**
 * Latest-run status line for the fire-and-forget jobs on this page: spinner
 * while the background run is going, the error on failure, `succeededText`
 * once it completes.
 */
function JobRunStatusLine({ run, succeededText }: { run: JobRunView; succeededText: string }) {
  if (run.status === "running") {
    return (
      <p className="text-muted-foreground flex items-center gap-1 text-sm">
        <LoaderIcon className="size-4 animate-spin" />
        Running…
      </p>
    );
  }
  if (run.status === "failed") {
    return (
      <p className="text-muted-foreground flex items-center gap-1 text-sm">
        <XIcon className="text-destructive size-4 shrink-0" />
        {run.errorMessage ?? "Failed"}
      </p>
    );
  }
  return (
    <p className="text-muted-foreground flex items-center gap-1 text-sm">
      <CheckIcon className="text-success size-4 shrink-0" />
      {succeededText}
    </p>
  );
}

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
  const refreshMatviews = useRefreshMatviews();
  const recomputeCardTokens = useRecomputeCardTokens();
  const matviewsRun = useLatestJobRunByKind(MATVIEWS_REFRESH_KIND);
  const cardTokensRun = useLatestJobRunByKind(CARD_TOKENS_RECOMPUTE_KIND);

  const matviewsRunning = refreshMatviews.isPending || matviewsRun.data?.status === "running";
  const cardTokensRunning =
    recomputeCardTokens.isPending || cardTokensRun.data?.status === "running";

  async function handlePurge() {
    try {
      await purge.mutateAsync();
      toast.success("Cloudflare cache purged");
    } catch {
      // Reported by the global mutation error toast (see reportMutationError).
    }
  }

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
            disabled={clearSsrCache.isPending}
          >
            {clearSsrCache.isPending ? (
              <LoaderIcon className="size-4 animate-spin" />
            ) : (
              <EraserIcon className="size-4" />
            )}
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
            onClick={() =>
              refreshMatviews.mutate(undefined, { onSuccess: () => void matviewsRun.refetch() })
            }
            disabled={matviewsRunning}
          >
            {matviewsRunning ? (
              <LoaderIcon className="size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
            Refresh materialized views
          </Button>
        </div>
        {matviewsRun.data && (
          <JobRunStatusLine run={matviewsRun.data} succeededText="Materialized views refreshed" />
        )}
      </SettingsSection>

      <SettingsSection
        title="Card Tokens"
        description="Re-reads every card's English rules text and rebuilds the list of tokens each one tells the player to create, which is what the deck pages show under Tokens. Card and errata edits already update the card they touch, so this is for the first backfill and after a bulk set import. Manually corrected entries are left alone."
      >
        <div>
          <Button
            variant="outline"
            onClick={() =>
              recomputeCardTokens.mutate(undefined, {
                onSuccess: () => void cardTokensRun.refetch(),
              })
            }
            disabled={cardTokensRunning}
          >
            {cardTokensRunning ? (
              <LoaderIcon className="size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
            Re-derive card tokens
          </Button>
        </div>
        {cardTokensRun.data && (
          <JobRunStatusLine
            run={cardTokensRun.data}
            succeededText={cardTokensSucceededText(cardTokensRun.data.result)}
          />
        )}
      </SettingsSection>

      <SettingsSection
        title="Cloudflare Cache"
        description="Purges everything cached by Cloudflare for this zone (HTML pages, API responses, images). Use this after deploying changes that affect cached URLs, or when fixing bad data that visitors may still see. The next request for each URL will re-fetch from the origin."
      >
        <div>
          {data.configured ? (
            <AlertDialog>
              <AlertDialogTrigger
                disabled={purge.isPending}
                render={<Button variant="destructive" />}
              >
                {purge.isPending ? (
                  <LoaderIcon className="size-4 animate-spin" />
                ) : (
                  <TrashIcon className="size-4" />
                )}
                Purge Cloudflare cache
              </AlertDialogTrigger>
              <AlertDialogContent>
                <DialogForm onSubmit={() => void handlePurge()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Purge all Cloudflare cache?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Every cached URL for this zone will be evicted. The next visitor to each page
                      will briefly see a slower response while the cache warms up again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogPrimitive.Close
                      render={<Button type="submit" variant="destructive" />}
                    >
                      Purge
                    </AlertDialogPrimitive.Close>
                  </AlertDialogFooter>
                </DialogForm>
              </AlertDialogContent>
            </AlertDialog>
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
