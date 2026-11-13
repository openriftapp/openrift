import { DAY_MS } from "@openrift/shared/format-date";
import { JOB_KIND, META_SOURCE_JOB_KINDS } from "@openrift/shared/job-run-kinds";
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
import { isRehostRetryNoop, retryDueRehosts } from "./modules/catalog/services/images/jobs.js";
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
import { inferMetaDeckSlots, isInferSlotsNoop } from "./modules/meta/services/meta-infer-slots.js";
import {
  createMetaSyncDeps,
  createPlayloltcgSyncDeps,
  createPlayriftboundSyncDeps,
  createTopdeckSyncDeps,
  isCatalogSyncNoop,
  isPlayloltcgRecheckNoop,
  isPlayloltcgSyncNoop,
  isPlayriftboundRecheckNoop,
  isPlayriftboundSyncNoop,
  isRecheckNoop,
  isTopdeckSyncNoop,
  processPlayloltcgRechecks,
  processPlayriftboundRechecks,
  processRechecks,
  metaJobSkipReason,
  syncCatalog,
  syncPlayloltcgCatalog,
  syncPlayriftboundCatalog,
  syncTopdeckCatalog,
} from "./modules/meta/services/meta-sync/index.js";
import { rebuildScanBank } from "./modules/scan/services/scan-bank.js";
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

  const skipMetaTick = (kind: string) => () => metaJobSkipReason(repos.jobRuns, kind, new Date());
  const playriftboundDeps = (jobLog: Logger) =>
    createPlayriftboundSyncDeps({
      repos,
      transact,
      fetch: globalThis.fetch,
      log: jobLog,
      baseUrl: config.metaSync.playriftboundBaseUrl,
    });

  return [
    defineJob(log, {
      kind: JOB_KIND.refreshTcgplayer,
      title: "TCGplayer price refresh",
      description: "Fetches the current TCGplayer prices for every mapped printing.",
      suggestedSchedule: "0 6 * * *",
      execute: (_runId, jobLog) => refreshTcgplayerPrices(globalThis.fetch, repos, jobLog),
    }),
    defineJob(log, {
      kind: JOB_KIND.refreshCardmarket,
      title: "Cardmarket price refresh",
      description: "Fetches the current Cardmarket prices for every mapped printing.",
      suggestedSchedule: "15 6 * * *",
      execute: (_runId, jobLog) => refreshCardmarketPrices(globalThis.fetch, repos, jobLog),
    }),
    defineJob(log, {
      kind: JOB_KIND.refreshCardtrader,
      title: "CardTrader price refresh",
      description: "Fetches the current CardTrader prices for every mapped printing.",
      suggestedSchedule: "30 6 * * *",
      unavailableReason: config.cardtraderApiToken ? undefined : "CARDTRADER_API_TOKEN is not set.",
      execute: (_runId, jobLog) =>
        refreshCardtraderPrices(globalThis.fetch, repos, jobLog, config.cardtraderApiToken),
    }),
    defineJob(log, {
      kind: JOB_KIND.refreshCardnexus,
      title: "CardNexus price refresh",
      description: "Fetches the current CardNexus prices for every mapped printing.",
      suggestedSchedule: "45 6 * * *",
      unavailableReason: config.cardnexusApiKey ? undefined : "CARDNEXUS_API_KEY is not set.",
      execute: (_runId, jobLog) =>
        refreshCardnexusPrices(globalThis.fetch, repos, jobLog, config.cardnexusApiKey),
    }),
    defineJob(log, {
      kind: JOB_KIND.postChangelog,
      title: "Changelog Discord post",
      description: "Posts new changelog entries to the announcements channel on Discord.",
      suggestedSchedule: "0 20 * * *",
      unavailableReason: config.discordWebhooks.changelog
        ? undefined
        : "DISCORD_WEBHOOK_CHANGELOG is not set.",
      execute: async (runId, jobLog) => {
        const prior = await repos.jobRuns.getLatestForResume(JOB_KIND.postChangelog);
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
      kind: JOB_KIND.flushPrintingEvents,
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
      kind: JOB_KIND.cleanupJobRuns,
      title: "Job history cleanup",
      description: `Deletes job runs older than ${JOB_RUNS_RETENTION_DAYS} days.`,
      suggestedSchedule: "0 4 * * *",
      execute: async () => {
        const cutoff = new Date(Date.now() - JOB_RUNS_RETENTION_DAYS * DAY_MS);
        const deleted = await repos.jobRuns.purgeOlderThan(cutoff);
        return { deleted, cutoff: cutoff.toISOString() };
      },
      classifyNoop: (summary) => summary.deleted === 0,
    }),
    defineJob(log, {
      kind: JOB_KIND.sweepSubmissionUploads,
      title: "Submission upload sweep",
      description:
        "Deletes contributor photo uploads older than 7 days that never became a submission.",
      suggestedSchedule: "0 4 * * *",
      execute: () => sweepSubmissionUploads(defaultIo, repos, { now: new Date() }),
      classifyNoop: (result) => result.deleted === 0,
    }),
    defineJob(log, {
      kind: JOB_KIND.sweepCopyDeletions,
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
      kind: JOB_KIND.fingerprintImages,
      title: "Image fingerprint sweep",
      description:
        "Fingerprints live and source images so check matching can tell a rehosted copy from a different image.",
      suggestedSchedule: "*/5 * * * *",
      execute: (_runId, jobLog) => sweepImageFingerprints(defaultIo, repos, jobLog),
      classifyNoop: isFingerprintSweepNoop,
    }),
    defineJob(log, {
      kind: JOB_KIND.retryImageRehosts,
      title: "Image rehost retry",
      description:
        "Copies images that are waiting to go live to our server, retrying failed copies with a growing delay.",
      suggestedSchedule: "*/15 * * * *",
      execute: () => retryDueRehosts(defaultIo, repos.printingImages),
      classifyNoop: isRehostRetryNoop,
    }),
    defineJob(log, {
      kind: JOB_KIND.checkMatching,
      title: "Check matching sources",
      description:
        "Marks unchecked source rows checked when every value they provide equals the live card or printing.",
      suggestedSchedule: "30 5 * * *",
      execute: () => checkMatchingCandidates(repos, new Date()),
      classifyNoop: (result) => result.cardsChecked === 0 && result.printingsChecked === 0,
    }),
    defineJob(log, {
      kind: JOB_KIND.expirePendingTrades,
      title: "Expire pending trades",
      description: "Closes trade offers nobody answered before their deadline.",
      suggestedSchedule: "*/15 * * * *",
      execute: () => repos.cardTrades.expirePending(),
      classifyNoop: (result) => result.expired === 0,
    }),
    defineJob(log, {
      kind: JOB_KIND.emailTradeMatchDigest,
      title: "Trade match digest",
      description: "Emails each member the new trade matches found since the last digest.",
      suggestedSchedule: "0 8 * * *",
      execute: async (_runId, jobLog) => {
        const prior = await repos.jobRuns.getLatestForResume(JOB_KIND.emailTradeMatchDigest);
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
      kind: JOB_KIND.emailFlushTradeRequests,
      title: "Trade request emails",
      description: "Sends the follow-up email once a burst of trade requests has settled.",
      suggestedSchedule: "* * * * *",
      execute: (_runId, jobLog) =>
        flushCoalescedTradeRequests({ ...emailDeps, repos, log: jobLog }),
      classifyNoop: isTradeRequestFlushNoop,
    }),
    defineJob(log, {
      kind: JOB_KIND.emailFlushTradeStatus,
      title: "Trade status emails",
      description: "Tells the other party a trade was accepted, declined or cancelled.",
      suggestedSchedule: "* * * * *",
      execute: (_runId, jobLog) => flushTradeStatusEmails({ ...emailDeps, repos, log: jobLog }),
      classifyNoop: isTradeStatusFlushNoop,
    }),
    defineJob(log, {
      kind: META_SOURCE_JOB_KINDS.uvsgames.sync,
      title: "UVS Games: refresh mirror",
      description: "Reads the UVS Games event list and queues anything new for a full fetch.",
      suggestedSchedule: "0 6 * * *",
      skipCronTick: skipMetaTick(META_SOURCE_JOB_KINDS.uvsgames.sync),
      execute: (runId, jobLog) => syncCatalog(metaDeps(jobLog), runId),
      classifyNoop: isCatalogSyncNoop,
    }),
    defineJob(log, {
      kind: META_SOURCE_JOB_KINDS.uvsgames.recheck,
      title: "UVS Games: collect results",
      description:
        "Re-fetches queued UVS Games events until their results are published. Once an hour it also re-reads the last three days of the listing.",
      suggestedSchedule: "*/10 * * * *",
      skipCronTick: skipMetaTick(META_SOURCE_JOB_KINDS.uvsgames.recheck),
      execute: (runId, jobLog) =>
        processRechecks(metaDeps(jobLog), { runId, listing: isFirstTickOfHour(new Date()) }),
      classifyNoop: isRecheckNoop,
    }),
    defineJob(log, {
      kind: META_SOURCE_JOB_KINDS.playloltcg.sync,
      title: "PlayLoLTCG: refresh mirror",
      description: "Reads the PlayLoLTCG event list and queues anything new for a full fetch.",
      suggestedSchedule: "0 7 * * *",
      skipCronTick: skipMetaTick(META_SOURCE_JOB_KINDS.playloltcg.sync),
      execute: (_runId, jobLog) => syncPlayloltcgCatalog(playloltcgDeps(jobLog)),
      classifyNoop: isPlayloltcgSyncNoop,
    }),
    defineJob(log, {
      kind: META_SOURCE_JOB_KINDS.playloltcg.recheck,
      title: "PlayLoLTCG: collect results",
      description:
        "Re-fetches queued PlayLoLTCG events until their results are published. Once an hour it also re-reads the last three days of the listing.",
      suggestedSchedule: "*/10 * * * *",
      skipCronTick: skipMetaTick(META_SOURCE_JOB_KINDS.playloltcg.recheck),
      execute: (runId, jobLog) =>
        processPlayloltcgRechecks(playloltcgDeps(jobLog), {
          runId,
          listing: isFirstTickOfHour(new Date()),
        }),
      classifyNoop: isPlayloltcgRecheckNoop,
    }),
    defineJob(log, {
      kind: META_SOURCE_JOB_KINDS.topdeck.sync,
      title: "Topdeck: refresh mirror",
      description:
        "Reads the last month of Topdeck tournaments, with their standings and decklists.",
      suggestedSchedule: "30 7 * * *",
      unavailableReason: topdeckApiKey === null ? "TOPDECK_API_KEY is not set." : undefined,
      skipCronTick: skipMetaTick(META_SOURCE_JOB_KINDS.topdeck.sync),
      execute: (_runId, jobLog) => syncTopdeckCatalog(topdeckDeps(jobLog)),
      classifyNoop: isTopdeckSyncNoop,
    }),
    defineJob(log, {
      kind: META_SOURCE_JOB_KINDS.playriftbound.sync,
      title: "PlayRiftbound: refresh mirror",
      description:
        "Searches around every known PlayRiftbound store for events from the last week to two weeks ahead.",
      suggestedSchedule: "0 8 * * *",
      skipCronTick: skipMetaTick(META_SOURCE_JOB_KINDS.playriftbound.sync),
      execute: (_runId, jobLog) => syncPlayriftboundCatalog(playriftboundDeps(jobLog)),
      classifyNoop: isPlayriftboundSyncNoop,
    }),
    defineJob(log, {
      kind: META_SOURCE_JOB_KINDS.playriftbound.recheck,
      title: "PlayRiftbound: collect results",
      description:
        "Re-fetches queued PlayRiftbound events whenever the source reports a change, until they finish. Once an hour it also re-queues the events running now.",
      suggestedSchedule: "*/10 * * * *",
      skipCronTick: skipMetaTick(META_SOURCE_JOB_KINDS.playriftbound.recheck),
      execute: (runId, jobLog) =>
        processPlayriftboundRechecks(playriftboundDeps(jobLog), {
          runId,
          rearm: isFirstTickOfHour(new Date()),
        }),
      classifyNoop: isPlayriftboundRecheckNoop,
    }),
    defineJob(log, {
      kind: JOB_KIND.metaInferSlots,
      title: "Meta archive: guess missing champions and battlefields",
      description:
        "Recomputes the likely chosen champion and one battlefield of every partial list from the complete lists of the same legend.",
      suggestedSchedule: "30 7 * * *",
      execute: () => inferMetaDeckSlots(repos),
      classifyNoop: isInferSlotsNoop,
    }),
    defineJob(log, {
      kind: JOB_KIND.rebuildScanBank,
      title: "Scan bank rebuild",
      description:
        "Rebuilds the scanner's card bank when card images, card details or the encoder changed since the last build.",
      suggestedSchedule: "0 5 * * *",
      execute: async (_runId, jobLog) => {
        const prior = await repos.jobRuns.getLatestForResume(JOB_KIND.rebuildScanBank);
        return await rebuildScanBank(
          { repos, io: defaultIo, log: jobLog, encoderFile: config.scan.encoderFile },
          { previousResult: prior?.result },
        );
      },
      classifyNoop: (result) => result.unchanged,
    }),
  ];
}
