import { createLogger } from "@openrift/shared/logger";
import type { Logger } from "@openrift/shared/logger";
import type { EmailNotificationChannel } from "@openrift/shared/types/api/preferences";
import { createTransport } from "nodemailer";

import { buildUnsubscribeUrls } from "./emails/unsubscribe-token.js";
import type { Config } from "./types.js";

const log = createLogger("email");

export function createEmailSender(smtp: Config["smtp"], isDev: boolean) {
  // better-auth swallows email-send failures, so missing SMTP outside dev
  // silently drops verification and password-reset mail.
  if (!smtp.configured && !isDev) {
    throw new Error(
      "SMTP is not configured (SMTP_HOST is unset) outside development. " +
        "Refusing to start: verification and password-reset emails would be silently dropped.",
    );
  }

  const transporter = smtp.configured
    ? createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
      })
    : null;

  if (!transporter) {
    log.warn("SMTP not configured — emails will be logged to console");
  }

  return async function sendEmail({
    to,
    subject,
    html,
    listUnsubscribeUrl,
  }: {
    to: string;
    subject: string;
    html: string;
    listUnsubscribeUrl?: string;
  }) {
    // RFC 8058 requires both headers together, or the URL is treated as a legacy link.
    const headers = listUnsubscribeUrl
      ? {
          "List-Unsubscribe": `<${listUnsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : undefined;

    if (!transporter) {
      log.info({ to, subject }, "Email (not sent):\n%s", html);
      return;
    }

    try {
      return await transporter.sendMail({
        from: smtp.from,
        to,
        subject,
        html,
        headers,
      });
    } catch (error) {
      log.error({ to, err: error }, "Failed to send email");
      throw error;
    }
  };
}

export type SendEmail = ReturnType<typeof createEmailSender>;

export interface EmailDeps {
  sendEmail: SendEmail;
  appBaseUrl: string;
  unsubscribeSecret: string;
  log: Logger;
}

export function createEmailDeps(config: Config, sendEmail: SendEmail, logger: Logger): EmailDeps {
  return {
    sendEmail,
    appBaseUrl: config.appBaseUrl,
    unsubscribeSecret: config.auth.secret,
    log: logger,
  };
}

/** Without deps (tests, an SMTP-less env) the service runs with its email step skipped. */
export function bindEmailDeps<A, B, R>(
  run: (first: A, second: B, deps?: EmailDeps) => R,
  deps?: EmailDeps,
): (first: A, second: B) => R {
  return deps === undefined ? run : (first, second) => run(first, second, deps);
}

export interface ChannelEmailRecipient {
  userId: string;
  email: string;
}

/** Never throws: a failed send is logged with `logContext` and reported as `false`. */
export async function sendChannelEmail(
  deps: EmailDeps,
  recipient: ChannelEmailRecipient,
  channel: EmailNotificationChannel,
  build: (links: { unsubscribeUrl: string }) => { subject: string; html: string },
  logContext?: Record<string, unknown>,
): Promise<boolean> {
  try {
    const { pageUrl, oneClickUrl } = buildUnsubscribeUrls(
      deps.appBaseUrl,
      deps.unsubscribeSecret,
      recipient.userId,
      channel,
    );
    const { subject, html } = build({ unsubscribeUrl: pageUrl });
    await deps.sendEmail({ to: recipient.email, subject, html, listUnsubscribeUrl: oneClickUrl });
    return true;
  } catch (error) {
    deps.log.error(
      { err: error, userId: recipient.userId, channel, ...logContext },
      "Failed to send notification email",
    );
    return false;
  }
}
