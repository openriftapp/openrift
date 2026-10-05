import type { Logger } from "@openrift/shared/logger";
import type { Kysely } from "kysely";

import type { Database } from "./db/tables.js";
import type { Repos } from "./deps.js";
import { createTransact } from "./deps.js";
import { createEmailDeps } from "./email.js";
import type { SendEmail } from "./email.js";
import { defaultIo } from "./io.js";
import { checkMatchingCandidates } from "./modules/candidates/services/check-matching-candidates.js";
import { sweepSubmissionUploads } from "./modules/candidates/services/submission-uploads.js";
import {
  flushPendingPrintingEvents,
  isPrintingFlushNoop,
} from "./modules/catalog/services/flush-printing-events.js";
import {
  isFingerprintSweepNoop,
  sweepImageFingerprints,
} from "./modules/catalog/services/images/fingerprint-sweep.js";
import { COPY_DELETION_RETENTION_MS } from "./modules/collections/lib/copy-deletion-retention.js";
import {
  extractDigestWatermark,
  isTradeMatchDigestNoop,
  sendTradeMatchDigest,
} from "./modules/groups/services/trade-match-digest.js";
import {
  flushCoalescedTradeRequests,
  isTradeRequestFlushNoop,
} from "./modules/groups/services/trade-notifications.js";
import {
  flushTradeStatusEmails,
  isTradeStatusFlushNoop,
} from "./modules/groups/services/trade-status-notifications.js";
import { refreshCardmarketPrices } from "./modules/marketplace/services/price-refresh/cardmarket.js";
import { refreshCardnexusPrices } from "./modules/marketplace/services/price-refresh/cardnexus.js";
import { refreshCardtraderPrices } from "./modules/marketplace/services/price-refresh/cardtrader.js";
import { refreshTcgplayerPrices } from "./modules/marketplace/services/price-refresh/tcgplayer.js";
import {
  createMetaSyncDeps,
  createPlayloltcgSyncDeps,
  createTopdeckSyncDeps,
  isCatalogSyncNoop,
  isPlayloltcgRecheckNoop,
  isPlayloltcgSyncNoop,
  isRecheckNoop,
  isTopdeckSyncNoop,
  playloltcgCoolingDown,
  processPlayloltcgRechecks,
  processRechecks,
  syncCatalog,
  syncPlayloltcgCatalog,
  syncTopdeckCatalog,
} from "./modules/meta/services/meta-sync/index.js";
import {
  extractWatermark,
  postChangelogToDiscord,
} from "./modules/system/services/changelog-discord.js";
import type { AnyJobDefinition } from "./modules/system/services/job-scheduler.js";
import { defineJob } from "./modules/system/services/job-scheduler.js";
import type { Config } from "./types.js";

const JOB_RUNS_RETENTION_DAYS = 30;

// The recheck crons tick every ten minutes; one tick an hour also reads the listing.
function isFirstTickOfHour(now: Date): boolean {
  return now.getUTCMinutes() < 10;
}

interface JobDefinitionDeps {
  config: Config;
  repos: Repos;
  db: Kysely<Database>;
  sendEmail: SendEmail;
  log: Logger;
}

/** In `SCHEDULED_JOB_KINDS` order; `list()` shows them in this order. */
export function createJobDefinitions(deps: JobDefinitionDeps): AnyJobDefinition[] {
  const { config, repos, db, sendEmail, log } = deps;
  const transact = createTransact(db);
  const emailDeps = createEmailDeps(config, sendEmail, log);

  const metaDeps = (jobLog: Logger) =>
    createMetaSyncDeps({
      repos,
      transact,
      fetch: globalThis.fetch,
      log: jobLog,
      baseUrl: config.metaSync.baseUrl,
    });

  const playloltcgDeps = (jobLog: Logger) =>
    createPlayloltcgSyncDeps({
      repos,
      transact,
      fetch: globalThis.fetch,
      log: jobLog,
      baseUrl: config.metaSync.playloltcgBaseUrl,
    });

  const topdeckApiKey = config.metaSync.topdeckApiKey;
  const topdeckDeps = (jobLog: Logger) =>
    createTopdeckSyncDeps({
      repos,
      transact,
      fetch: globalThis.fetch,
      log: jobLog,
      baseUrl: config.metaSync.topdeckBaseUrl,
      apiKey: topdeckApiKey ?? "",
    });

  return [
    defineJob(log, {
      kind: "tcgplayer.refresh",
      title: "TCGPlayer price refresh",
      description: "Fetches the current TCGPlayer prices for every mapped printing.",
      suggestedSchedule: "0 6 * * *",
      execute: (_runId, jobLog) => refreshTcgplayerPrices(globalThis.fetch, repos, jobLog),
    }),
    defineJob(log, {
      kind: "cardmarket.refresh",
      title: "Cardmarket price refresh",
      description: "Fetches the current Cardmarket prices for every mapped printing.",
      suggestedSchedule: "15 6 * * *",
      execute: (_runId, jobLog) => refreshCardmarketPrices(globalThis.fetch, repos, jobLog),
    }),
    defineJob(log, {
      kind: "cardtrader.refresh",
      title: "CardTrader price refresh",
      description: "Fetches the current CardTrader prices for every mapped printing.",
      suggestedSchedule: "30 6 * * *",
      unavailableReason: config.cardtraderApiToken ? undefined : "CARDTRADER_API_TOKEN is not set.",
      execute: (_runId, jobLog) =>
        refreshCardtraderPrices(globalThis.fetch, repos, jobLog, config.cardtraderApiToken),
    }),
    defineJob(log, {
      kind: "cardnexus.refresh",
      title: "CardNexus price refresh",
      description: "Fetches the current CardNexus prices for every mapped printing.",
      suggestedSchedule: "45 6 * * *",
      unavailableReason: config.cardnexusApiKey ? undefined : "CARDNEXUS_API_KEY is not set.",
      execute: (_runId, jobLog) =>
        refreshCardnexusPrices(globalThis.fetch, repos, jobLog, config.cardnexusApiKey),
    }),
    defineJob(log, {
      kind: "discord.post_changelog",
      title: "Changelog Discord post",
      description: "Posts new changelog entries to the announcements channel on Discord.",
      suggestedSchedule: "0 20 * * *",
      unavailableReason: config.discordWebhooks.changelog
        ? undefined
        : "DISCORD_WEBHOOK_CHANGELOG is not set.",
      execute: async (runId, jobLog) => {
        const prior = await repos.jobRuns.getLatestForResume("discord.post_changelog");
        return await postChangelogToDiscord({
          webhookUrl: config.discordWebhooks.changelog,
          changelogPath: config.changelogPath,
          jobRuns: repos.jobRuns,
          runId,
          fromDate: extractWatermark(prior?.result),
          log: jobLog,
        });
      },
    }),
    defineJob(log, {
      kind: "discord.flush_printing_events",
      title: "New-printing Discord posts",
      description: "Posts the cards added since the last run to the new-printings channel.",
      suggestedSchedule: "*/15 * * * *",
      unavailableReason: config.discordWebhooks.newPrintings
        ? undefined
        : "DISCORD_WEBHOOK_NEW_PRINTINGS is not set.",
      execute: (_runId, jobLog) =>
        flushPendingPrintingEvents(
          repos,
          { newPrintings: config.discordWebhooks.newPrintings },
          config.appBaseUrl,
          jobLog,
        ),
      classifyNoop: isPrintingFlushNoop,
    }),
    defineJob(log, {
      kind: "job_runs.cleanup",
      title: "Job history cleanup",
      description: `Deletes job runs older than ${JOB_RUNS_RETENTION_DAYS} days.`,
      suggestedSchedule: "0 4 * * *",
      execute: async () => {
        const cutoff = new Date(Date.now() - JOB_RUNS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const deleted = await repos.jobRuns.purgeOlderThan(cutoff);
        return { deleted, cutoff: cutoff.toISOString() };
      },
      classifyNoop: (summary) => summary.deleted === 0,
    }),
    defineJob(log, {
      kind: "submission_uploads.sweep",
      title: "Submission upload sweep",
      description:
        "Deletes contributor photo uploads older than 7 days that never became a submission.",
      suggestedSchedule: "0 4 * * *",
      execute: () => sweepSubmissionUploads(defaultIo, repos, { now: new Date() }),
      classifyNoop: (result) => result.deleted === 0,
    }),
    defineJob(log, {
      kind: "copy_deletions.sweep",
      title: "Copy tombstone sweep",
      description:
        "Drops copy deletion tombstones past the sync window. A client whose watermark is older takes a full read instead.",
      suggestedSchedule: "0 4 * * *",
      execute: async () => {
        const cutoff = new Date(Date.now() - COPY_DELETION_RETENTION_MS);
        const deleted = await repos.copies.purgeDeletionsOlderThan(cutoff);
        return { deleted, cutoff: cutoff.toISOString() };
      },
      classifyNoop: (summary) => summary.deleted === 0,
    }),
    defineJob(log, {
      kind: "images.fingerprint",
      title: "Image fingerprint sweep",
      description:
        "Fingerprints live and source images so check matching can tell a rehosted copy from a different image.",
      suggestedSchedule: "*/5 * * * *",
      execute: (_runId, jobLog) => sweepImageFingerprints(defaultIo, repos, jobLog),
      classifyNoop: isFingerprintSweepNoop,
    }),
    defineJob(log, {
      kind: "candidates.check_matching",
      title: "Check matching sources",
      description:
        "Marks unchecked source rows checked when every value they provide equals the live card or printing.",
      suggestedSchedule: "30 5 * * *",
      execute: () => checkMatchingCandidates(repos, new Date()),
      classifyNoop: (result) => result.cardsChecked === 0 && result.printingsChecked === 0,
    }),
    defineJob(log, {
      kind: "card_trades.expire_pending",
      title: "Expire pending trades",
      description: "Closes trade offers nobody answered before their deadline.",
      suggestedSchedule: "*/15 * * * *",
      execute: () => repos.cardTrades.expirePending(),
      classifyNoop: (result) => result.expired === 0,
    }),
    defineJob(log, {
      kind: "email.trade_match_digest",
      title: "Trade match digest",
      description: "Emails each member the new trade matches found since the last digest.",
      suggestedSchedule: "0 8 * * *",
      execute: async (_runId, jobLog) => {
        const prior = await repos.jobRuns.getLatestForResume("email.trade_match_digest");
        const sinceTimestamp = extractDigestWatermark(prior?.result);
        // Watermark from the run start, not its end, so matches created mid-run
        // aren't skipped (at worst re-sent next day).
        const runStartedAt = new Date();
        const result = await sendTradeMatchDigest({
          ...emailDeps,
          repos,
          log: jobLog,
          sinceTimestamp,
        });
        return { ...result, lastRunAt: runStartedAt.toISOString() };
      },
      classifyNoop: isTradeMatchDigestNoop,
    }),
    defineJob(log, {
      kind: "email.flush_trade_requests",
      title: "Trade request emails",
      description: "Sends the follow-up email once a burst of trade requests has settled.",
      suggestedSchedule: "* * * * *",
      execute: (_runId, jobLog) =>
        flushCoalescedTradeRequests({ ...emailDeps, repos, log: jobLog }),
      classifyNoop: isTradeRequestFlushNoop,
    }),
    defineJob(log, {
      kind: "email.flush_trade_status",
      title: "Trade status emails",
      description: "Tells the other party a trade was accepted, declined or cancelled.",
      suggestedSchedule: "* * * * *",
      execute: (_runId, jobLog) => flushTradeStatusEmails({ ...emailDeps, repos, log: jobLog }),
      classifyNoop: isTradeStatusFlushNoop,
    }),
    defineJob(log, {
      kind: "meta.uvsgames_sync",
      title: "UVS Games event sync",
      description: "Reads the UVS Games event list and queues anything new for a full fetch.",
      suggestedSchedule: "0 6 * * *",
      execute: (runId, jobLog) => syncCatalog(metaDeps(jobLog), runId),
      classifyNoop: isCatalogSyncNoop,
    }),
    defineJob(log, {
      kind: "meta.uvsgames_recheck",
      title: "UVS Games event recheck",
      description:
        "Re-fetches queued UVS Games events until their results are published. Once an hour it also re-reads the last three days of the listing.",
      suggestedSchedule: "*/10 * * * *",
      execute: (runId, jobLog) =>
        processRechecks(metaDeps(jobLog), { runId, listing: isFirstTickOfHour(new Date()) }),
      classifyNoop: isRecheckNoop,
    }),
    defineJob(log, {
      kind: "meta.playloltcg_sync",
      title: "PlayLoLTCG event sync",
      description: "Reads the PlayLoLTCG event list and queues anything new for a full fetch.",
      suggestedSchedule: "0 7 * * *",
      skipCronTick: async (jobLog) => {
        const cooling = await playloltcgCoolingDown(
          playloltcgDeps(jobLog),
          "meta.playloltcg_sync",
          new Date(),
        );
        return cooling ? "playloltcg sync cooling down after a WAF block; skipping" : null;
      },
      execute: (_runId, jobLog) => syncPlayloltcgCatalog(playloltcgDeps(jobLog)),
      classifyNoop: isPlayloltcgSyncNoop,
    }),
    defineJob(log, {
      kind: "meta.playloltcg_recheck",
      title: "PlayLoLTCG event recheck",
      description:
        "Re-fetches queued PlayLoLTCG events until their results are published. Once an hour it also re-reads the last three days of the listing.",
      suggestedSchedule: "*/10 * * * *",
      skipCronTick: async (jobLog) => {
        const cooling = await playloltcgCoolingDown(
          playloltcgDeps(jobLog),
          "meta.playloltcg_recheck",
          new Date(),
        );
        return cooling
          ? "playloltcg recheck cooling down after a WAF block or repeated refusals; skipping"
          : null;
      },
      execute: (_runId, jobLog) =>
        processPlayloltcgRechecks(playloltcgDeps(jobLog), {
          listing: isFirstTickOfHour(new Date()),
        }),
      classifyNoop: isPlayloltcgRecheckNoop,
    }),
    defineJob(log, {
      kind: "meta.topdeck_sync",
      title: "Topdeck event sync",
      description:
        "Reads the last month of Topdeck tournaments, with their standings and decklists.",
      suggestedSchedule: "30 7 * * *",
      unavailableReason: topdeckApiKey === null ? "TOPDECK_API_KEY is not set." : undefined,
      execute: (_runId, jobLog) => syncTopdeckCatalog(topdeckDeps(jobLog)),
      classifyNoop: isTopdeckSyncNoop,
    }),
  ];
}
