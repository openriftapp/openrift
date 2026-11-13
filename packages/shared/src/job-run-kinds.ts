import type { META_CATALOG_PROVIDERS } from "./types/enums.js";
import type { Marketplace } from "./types/pricing.js";

/** What started a job run. Mirrors the `job_runs.trigger` CHECK. */
export const JOB_TRIGGERS = ["cron", "admin", "api"] as const;
/** Lifecycle of a job run. Mirrors the `job_runs.status` CHECK. */
export const JOB_STATUSES = ["running", "succeeded", "failed"] as const;
/** Derived filter over `job_runs.noop`, not a stored column. */
export const JOB_RUN_ACTIVITIES = ["did-work", "noop"] as const;

export const JOB_KIND = {
  refreshTcgplayer: "tcgplayer.refresh",
  refreshCardmarket: "cardmarket.refresh",
  refreshCardtrader: "cardtrader.refresh",
  refreshCardnexus: "cardnexus.refresh",
  postChangelog: "discord.post_changelog",
  flushPrintingEvents: "discord.flush_printing_events",
  cleanupJobRuns: "job_runs.cleanup",
  sweepSubmissionUploads: "submission_uploads.sweep",
  sweepCopyDeletions: "copy_deletions.sweep",
  fingerprintImages: "images.fingerprint",
  retryImageRehosts: "images.rehost_retry",
  regenerateImages: "images.regenerate",
  checkMatching: "candidates.check_matching",
  expirePendingTrades: "card_trades.expire_pending",
  emailTradeMatchDigest: "email.trade_match_digest",
  emailFlushTradeRequests: "email.flush_trade_requests",
  emailFlushTradeStatus: "email.flush_trade_status",
  rebuildScanBank: "scan.rebuild_bank",
  refreshMatviews: "matviews.refresh",
  recomputeCardTokens: "card_tokens.recompute",
  backfillSiblingVariants: "marketplace_variants.backfill_siblings",
  metaInferSlots: "meta.infer_slots",
  metaRetier: "meta.retier",
  metaRepromote: "meta.repromote",
} as const;

export const PRICE_REFRESH_JOB_KIND = {
  tcgplayer: JOB_KIND.refreshTcgplayer,
  cardmarket: JOB_KIND.refreshCardmarket,
  cardtrader: JOB_KIND.refreshCardtrader,
  cardnexus: JOB_KIND.refreshCardnexus,
} as const satisfies Record<Marketplace, string>;

type MetaSourceName = (typeof META_CATALOG_PROVIDERS)[number];

interface MetaSourceJobKinds {
  sync: string;
  backfill: string;
  autoAccept: string;
  recheck?: string;
  eventFetch?: string;
  idSweep?: string;
}

export const META_SOURCE_JOB_KINDS = {
  uvsgames: {
    sync: "meta.uvsgames_sync",
    backfill: "meta.uvsgames_backfill",
    recheck: "meta.uvsgames_recheck",
    idSweep: "meta.uvsgames_id_sweep",
    eventFetch: "meta.uvsgames_event_fetch",
    autoAccept: "meta.uvsgames_auto_accept",
  },
  playloltcg: {
    sync: "meta.playloltcg_sync",
    backfill: "meta.playloltcg_backfill",
    recheck: "meta.playloltcg_recheck",
    eventFetch: "meta.playloltcg_event_fetch",
    autoAccept: "meta.playloltcg_auto_accept",
  },
  topdeck: {
    sync: "meta.topdeck_sync",
    backfill: "meta.topdeck_backfill",
    autoAccept: "meta.topdeck_auto_accept",
  },
  playriftbound: {
    sync: "meta.playriftbound_sync",
    backfill: "meta.playriftbound_backfill",
    recheck: "meta.playriftbound_recheck",
    eventFetch: "meta.playriftbound_event_fetch",
    autoAccept: "meta.playriftbound_auto_accept",
  },
} as const satisfies Record<MetaSourceName, MetaSourceJobKinds>;

export const META_ARCHIVE_JOB_KINDS = [JOB_KIND.metaRetier, JOB_KIND.metaRepromote] as const;

export const META_JOB_KINDS = [
  ...Object.values(META_SOURCE_JOB_KINDS).flatMap((kinds) => Object.values(kinds)),
  ...META_ARCHIVE_JOB_KINDS,
];

export function metaSourceJobPrefix(source: MetaSourceName): string {
  return `meta.${source}_`;
}
