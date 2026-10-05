import type { Logger } from "@openrift/shared/logger";
import { describe, expect, it, vi } from "vitest";

import { bindEmailDeps, createEmailDeps, createEmailSender, sendChannelEmail } from "./email.js";
import type { EmailDeps } from "./email.js";
import type { Config } from "./types.js";

const unconfigured: Config["smtp"] = {
  configured: false,
  host: undefined,
  port: 465,
  secure: true,
  user: undefined,
  pass: undefined,
  from: undefined,
};

const configured: Config["smtp"] = {
  configured: true,
  host: "smtp.test",
  port: 465,
  secure: true,
  user: "user",
  pass: "pass",
  from: "from@test",
};

describe("createEmailSender", () => {
  it("throws when SMTP is unconfigured outside development", () => {
    expect(() => createEmailSender(unconfigured, false)).toThrow(/SMTP is not configured/u);
  });

  it("returns a console-logging sender when unconfigured in development", async () => {
    const sendEmail = createEmailSender(unconfigured, true);
    expect(typeof sendEmail).toBe("function");
    await expect(
      sendEmail({ to: "user@example.test", subject: "Hi", html: "<p>hi</p>" }),
    ).resolves.toBeUndefined();
  });

  it("builds a real sender when SMTP is configured", () => {
    const sendEmail = createEmailSender(configured, false);
    expect(typeof sendEmail).toBe("function");
  });
});

function emailDeps(sendEmail = vi.fn().mockResolvedValue(undefined)) {
  const error = vi.fn();
  const deps: EmailDeps = {
    sendEmail,
    appBaseUrl: "https://example.test",
    unsubscribeSecret: "secret",
    log: { error } as unknown as Logger,
  };
  return { deps, sendEmail, error };
}

describe("createEmailDeps", () => {
  it("takes the base URL and unsubscribe secret from config", () => {
    const sendEmail = vi.fn();
    const log = {} as Logger;
    const config = { appBaseUrl: "https://example.test", auth: { secret: "s" } } as Config;
    expect(createEmailDeps(config, sendEmail, log)).toEqual({
      sendEmail,
      appBaseUrl: "https://example.test",
      unsubscribeSecret: "s",
      log,
    });
  });
});

describe("bindEmailDeps", () => {
  it("passes the deps as the third argument", () => {
    const run = vi.fn((_a: string, _b: number, deps?: EmailDeps) => deps?.appBaseUrl);
    const { deps } = emailDeps();
    expect(bindEmailDeps(run, deps)("a", 1)).toBe("https://example.test");
    expect(run).toHaveBeenCalledWith("a", 1, deps);
  });

  it("returns the function unchanged without deps", () => {
    const run = vi.fn();
    expect(bindEmailDeps(run)).toBe(run);
  });
});

describe("sendChannelEmail", () => {
  const recipient = { userId: "user-1", email: "user@example.test" };

  it("sends with the footer link and the one-click header", async () => {
    const { deps, sendEmail } = emailDeps();
    const build = ({ unsubscribeUrl }: { unsubscribeUrl: string }) => ({
      subject: "Hi",
      html: unsubscribeUrl,
    });

    await expect(sendChannelEmail(deps, recipient, "tradeStatus", build)).resolves.toBe(true);

    const sent = sendEmail.mock.calls[0]?.[0];
    expect(sent.to).toBe("user@example.test");
    expect(sent.subject).toBe("Hi");
    expect(sent.html).toContain("https://example.test/unsubscribe?token=");
    expect(sent.listUnsubscribeUrl).toContain(
      "https://example.test/api/v1/unsubscribe/one-click?token=",
    );
  });

  it("logs and reports false when the send fails", async () => {
    const failure = new Error("smtp down");
    const { deps, error } = emailDeps(vi.fn().mockRejectedValue(failure));

    await expect(
      sendChannelEmail(deps, recipient, "tradeStatus", () => ({ subject: "s", html: "h" }), {
        tradeId: "t-1",
      }),
    ).resolves.toBe(false);

    expect(error).toHaveBeenCalledWith(
      { err: failure, userId: "user-1", channel: "tradeStatus", tradeId: "t-1" },
      "Failed to send notification email",
    );
  });

  it("reports false without sending when building the email throws", async () => {
    const { deps, sendEmail } = emailDeps();
    const result = await sendChannelEmail(deps, recipient, "tradeStatus", () => {
      throw new Error("bad template");
    });
    expect(result).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
