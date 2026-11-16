import { createConfig } from "../apps/api/src/config.js";
import { createRepos } from "../apps/api/src/deps.js";
import type { SendEmail } from "../apps/api/src/email.js";
import { createEmailSender } from "../apps/api/src/email.js";
import {
  isTradeMatchDigestNoop,
  runTradeMatchDigest,
  sendTradeMatchDigest,
} from "../apps/api/src/modules/groups/services/trade-match-digest.js";
import { runJobOutcome } from "../apps/api/src/modules/system/services/run-job.js";
/**
 * Runs the trade match digest now, without waiting for the cron. Sends nothing unless
 * `--apply` is given: a dry run prints each email's recipient and subject.
 *
 * Usage: bun --env-file=.env scripts/send-trade-digest.ts <ISO timestamp> [--apply] [--allow-remote]
 * Sends the matches created since the timestamp. With no SMTP configured, `--apply` prints
 * the emails to this console. An applied run is recorded as a digest job run, so the next
 * scheduled digest starts where this one did.
 */
import { JOB_KIND } from "../packages/shared/src/job-run-kinds.js";
import { createLogger } from "../packages/shared/src/logger.js";
import { parseScriptArgs, runWithDb, WRITE_OPTIONS } from "./env.js";

const {
  positionals: [sinceArg = ""],
  values: { apply = false, "allow-remote": allowRemote = false },
} = parseScriptArgs(
  WRITE_OPTIONS,
  "Usage: bun --env-file=.env scripts/send-trade-digest.ts <ISO timestamp> [--apply] [--allow-remote]",
  1,
);

const sinceTimestamp = new Date(sinceArg);
if (Number.isNaN(sinceTimestamp.getTime())) {
  console.error(`Not an ISO timestamp: ${sinceArg}`);
  process.exit(1);
}

const config = createConfig(process.env as Record<string, string | undefined>);

const dryRunSender: SendEmail = ({ to, subject }) => {
  console.log(`Would send "${subject}" to ${to}`);
  // oxlint-disable-next-line unicorn/no-useless-undefined -- SendEmail resolves to undefined when nothing is sent
  return Promise.resolve(undefined);
};

const log = createLogger("send-trade-digest");

await runWithDb(
  async (db) => {
    const repos = createRepos(db);
    const deps = {
      repos,
      log,
      sendEmail: apply ? createEmailSender(config.smtp, config.isDev) : dryRunSender,
      appBaseUrl: config.appBaseUrl,
      unsubscribeSecret: config.auth.secret,
    };
    if (!apply) {
      const result = await sendTradeMatchDigest({ ...deps, sinceTimestamp });
      console.log("Digest dry run (nothing sent):", result);
      return;
    }
    const outcome = await runJobOutcome(
      { repos, log },
      JOB_KIND.emailTradeMatchDigest,
      "admin",
      (runId) => runTradeMatchDigest(deps, runId, sinceTimestamp),
      { classifyNoop: isTradeMatchDigestNoop },
    );
    console.log("Digest run:", outcome);
    if (outcome.status !== "succeeded") {
      process.exitCode = 1;
    }
  },
  apply ? { allowRemote } : undefined,
);
