import { JOB_KIND } from "@openrift/shared/job-run-kinds";
import { describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import type { TradeMatchDigestDeps } from "./trade-match-digest.js";
import {
  extractDigestWatermark,
  isTradeMatchDigestNoop,
  runTradeMatchDigest,
  sendTradeMatchDigest,
} from "./trade-match-digest.js";

describe("extractDigestWatermark", () => {
  it("reads a valid ISO timestamp from the stored result", () => {
    const iso = "2026-06-17T08:00:00.000Z";
    const watermark = extractDigestWatermark({ lastRunAt: iso });
    expect(watermark).toEqual(new Date(iso));
  });

  it("returns null when there is no prior result", () => {
    expect(extractDigestWatermark(null)).toBeNull();
    expect(extractDigestWatermark(undefined)).toBeNull();
  });

  it("returns null when the result lacks a usable lastRunAt", () => {
    expect(extractDigestWatermark({})).toBeNull();
    expect(extractDigestWatermark({ lastRunAt: 12_345 })).toBeNull();
    expect(extractDigestWatermark({ lastRunAt: "not-a-date" })).toBeNull();
    expect(extractDigestWatermark("string")).toBeNull();
  });
});

describe("isTradeMatchDigestNoop", () => {
  it.each([
    {
      name: "is a no-op when no recipient was emailed and no match was included",
      result: { recipients: 0, emailsSent: 0, matches: 0, failed: 0, matchesDropped: 0 },
      expected: true,
    },
    {
      name: "did work when at least one digest email went out",
      result: { recipients: 4, emailsSent: 2, matches: 9, failed: 0, matchesDropped: 0 },
      expected: false,
    },
    {
      name: "is not a no-op when every send failed",
      result: { recipients: 2, emailsSent: 0, matches: 0, failed: 2, matchesDropped: 5 },
      expected: false,
    },
  ])("$name", ({ result, expected }) => {
    expect(isTradeMatchDigestNoop(result)).toBe(expected);
  });
});

/** Stubbed repos covering only what the digest reads: two recipients, one group each, one new match each. */
function digestRepos(): Repos {
  return {
    siteSettings: { getBool: async () => true },
    userPreferences: {
      listMatchDigestRecipients: async () => [
        { userId: "user-1", email: "one@example.test", name: "One", displayLocale: "en" },
        { userId: "user-2", email: "two@example.test", name: "Two", displayLocale: "de" },
      ],
    },
    friendGroups: {
      listGroupsForUser: async () => [
        { id: "group-1", name: "Summoner Skirmish", slug: "skirmish" },
      ],
      listMembers: async () => [{ userId: "user-9", userName: "Nine" }],
    },
    friendGroupMatches: {
      recentIncomingMatchesForFeed: async () => [
        {
          counterpartyUserId: "user-9",
          counterpartyName: "Nine",
          counterpartyImage: null,
          counterpartyGravatarHash: "hash",
          printingId: "printing-1",
          cardId: "card-1",
          matchedAt: new Date("2026-06-18T10:00:00.000Z"),
        },
      ],
    },
    catalog: {
      printingNamesByIds: async (ids: string[]) => new Map(ids.map((id) => [id, "Jinx"])),
    },
  } as unknown as Repos;
}

function digestDeps(sendEmail: TradeMatchDigestDeps["sendEmail"]): TradeMatchDigestDeps {
  return {
    repos: digestRepos(),
    log: { error: vi.fn() } as unknown as TradeMatchDigestDeps["log"],
    sendEmail,
    appBaseUrl: "https://example.test",
    unsubscribeSecret: "test-secret",
    sinceTimestamp: new Date("2026-06-17T00:00:00.000Z"),
  };
}

describe("sendTradeMatchDigest", () => {
  it("counts failed sends and the matches dropped with them", async () => {
    const sendEmail = vi.fn(() => Promise.reject(new Error("SMTP down")));
    const result = await sendTradeMatchDigest(
      digestDeps(sendEmail as unknown as TradeMatchDigestDeps["sendEmail"]),
    );

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      recipients: 2,
      emailsSent: 0,
      matches: 0,
      failed: 2,
      matchesDropped: 2,
    });
  });

  it("sends each recipient their own display language", async () => {
    const sendEmail = vi.fn(() => Promise.resolve());
    await sendTradeMatchDigest(
      digestDeps(sendEmail as unknown as TradeMatchDigestDeps["sendEmail"]),
    );

    const [english, german] = (
      sendEmail.mock.calls as unknown as [{ subject: string; html: string }][]
    ).map(([args]) => args);
    expect(english!.subject).toContain("in your trading groups");
    expect(english!.html).toContain('<html lang="en">');
    expect(german!.subject).toContain("in deinen Tauschgruppen");
    expect(german!.html).toContain('<html lang="de">');
  });

  it("reports no failures when every send succeeds", async () => {
    const sendEmail = vi.fn(() => Promise.resolve());
    const result = await sendTradeMatchDigest(
      digestDeps(sendEmail as unknown as TradeMatchDigestDeps["sendEmail"]),
    );

    expect(result).toEqual({
      recipients: 2,
      emailsSent: 2,
      matches: 2,
      failed: 0,
      matchesDropped: 0,
    });
  });
});

describe("runTradeMatchDigest", () => {
  function runDeps(overrides: Record<string, unknown> = {}) {
    const jobRuns = {
      getLatestForResume: vi.fn(async () => ({
        result: { lastRunAt: "2026-06-17T00:00:00.000Z" },
      })),
      mergeResult: vi.fn(async () => {}),
    };
    const { sinceTimestamp: _since, ...deps } = digestDeps(
      vi.fn(() => Promise.resolve()) as unknown as TradeMatchDigestDeps["sendEmail"],
    );
    const repos = { ...deps.repos, jobRuns, ...overrides } as unknown as Repos;
    return { deps: { ...deps, repos }, jobRuns };
  }

  it("starts at the previous run's watermark and returns its own", async () => {
    const { deps, jobRuns } = runDeps();
    const result = await runTradeMatchDigest(deps, "run-1");

    expect(jobRuns.getLatestForResume).toHaveBeenCalledWith(JOB_KIND.emailTradeMatchDigest);
    expect(result.emailsSent).toBe(2);
    expect(Number.isNaN(Date.parse(result.lastRunAt))).toBe(false);
  });

  it("mails the remaining recipients when one recipient's digest fails to build", async () => {
    let calls = 0;
    const { deps, jobRuns } = runDeps({
      catalog: {
        printingNamesByIds: async (ids: string[]) => {
          calls += 1;
          if (calls === 1) {
            throw new Error("db hiccup");
          }
          return new Map(ids.map((id) => [id, "Jinx"]));
        },
      },
    });

    const result = await runTradeMatchDigest(deps, "run-1");

    expect(result).toMatchObject({ recipients: 2, emailsSent: 1, failed: 1 });
    expect(deps.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
      expect.any(String),
    );
    expect(Number.isNaN(Date.parse(result.lastRunAt))).toBe(false);
    expect(jobRuns.mergeResult).not.toHaveBeenCalled();
  });

  it("keeps the previous watermark when the run throws before mailing anyone", async () => {
    const { deps, jobRuns } = runDeps({
      userPreferences: { listMatchDigestRecipients: () => Promise.reject(new Error("db gone")) },
    });

    await expect(runTradeMatchDigest(deps, "run-1")).rejects.toThrow("db gone");
    expect(jobRuns.mergeResult).toHaveBeenCalledWith("run-1", {
      lastRunAt: "2026-06-17T00:00:00.000Z",
    });
  });

  it("takes an explicit start without reading the previous run", async () => {
    const { deps, jobRuns } = runDeps();
    await runTradeMatchDigest(deps, "run-1", new Date("2026-06-17T00:00:00.000Z"));

    expect(jobRuns.getLatestForResume).not.toHaveBeenCalled();
  });
});
