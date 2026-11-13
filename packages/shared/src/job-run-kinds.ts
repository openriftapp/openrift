/** What started a job run. Mirrors the `job_runs.trigger` CHECK. */
export const JOB_TRIGGERS = ["cron", "admin", "api"] as const;
/** Lifecycle of a job run. Mirrors the `job_runs.status` CHECK. */
export const JOB_STATUSES = ["running", "succeeded", "failed"] as const;
/** Derived filter over `job_runs.noop`, not a stored column. */
export const JOB_RUN_ACTIVITIES = ["did-work", "noop"] as const;

export const JOB_KIND = {
  regenerateImages: "images.regenerate",
  rebuildScanBank: "scan.rebuild_bank",
  refreshMatviews: "matviews.refresh",
  recomputeCardTokens: "card_tokens.recompute",
  backfillSiblingVariants: "marketplace_variants.backfill_siblings",
  flushPrintingEvents: "discord.flush_printing_events",
  checkMatching: "candidates.check_matching",
} as const;
