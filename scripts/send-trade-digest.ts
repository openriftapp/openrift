/**
 * Runs the trade match digest now, without waiting for the cron. Sends nothing unless
 * `--apply` is given: a dry run prints each email's recipient and subject.
 *
 * Usage: bun --env-file=.env scripts/send-trade-digest.ts <ISO timestamp> [--apply] [--allow-remote]
 * Sends the matches created since the timestamp. With no SMTP configured, `--apply` prints
 * the emails to this console.
 */
import { createConfig } from "../apps/api/src/config.js";
import { createRepos } from "../apps/api/src/deps.js";
import type { SendEmail } from "../apps/api/src/email.js";
import { createEmailSender } from "../apps/api/src/email.js";
import { sendTradeMatchDigest } from "../apps/api/src/modules/groups/services/trade-match-digest.js";
import { parseScriptArgs, runWithDb, WRITE_OPTIONS } from "./env.js";

type DigestDeps = Parameters<typeof sendTradeMatchDigest>[0];

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

// The digest only calls `log.error`, for per-recipient failures.
const log = {
  error: (obj: unknown, msg?: string) => console.error(msg ?? "digest error", obj),
} as unknown as DigestDeps["log"];

await runWithDb(
  async (db) => {
    const result = await sendTradeMatchDigest({
      repos: createRepos(db),
      log,
      sendEmail: apply ? createEmailSender(config.smtp, config.isDev) : dryRunSender,
      appBaseUrl: config.appBaseUrl,
      unsubscribeSecret: config.auth.secret,
      sinceTimestamp,
    });

    console.log(`Digest run ${apply ? "complete" : "dry run (nothing sent)"}:`, result);
  },
  apply ? { allowRemote } : undefined,
);
