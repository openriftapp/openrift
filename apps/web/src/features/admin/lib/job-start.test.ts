import { JOB_KIND, PRICE_REFRESH_JOB_KIND } from "@openrift/shared/job-run-kinds";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler:
        (fn: (args: { context: { cookie: string }; data: unknown }) => unknown) =>
        (args: { data: unknown }) =>
          fn({ context: { cookie: "" }, data: args.data }),
      middleware: () => chain,
      validator: () => chain,
    };
    return chain;
  },
}));
vi.mock("@/lib/server-fns/middleware", () => ({ withCookies: () => {} }));
vi.mock("@/lib/server-fns/orpc-client", () => ({
  apiOrpcClient: () =>
    new Proxy(
      {},
      {
        get: (_target, method: string) => (input?: { kind?: string }) => {
          calls.push(input?.kind === undefined ? method : `${method}:${input.kind}`);
          return Promise.resolve({ runId: "run-1", status: "running" });
        },
      },
    ),
}));

const { startJobFn } = await import("./job-start");

describe("startJobFn", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("runs every scheduled kind through the schedule's run-now when asked to", async () => {
    await startJobFn({ data: { kind: JOB_KIND.rebuildScanBank, viaSchedule: true } });
    await startJobFn({ data: { kind: JOB_KIND.checkMatching, viaSchedule: true } });

    expect(calls).toEqual([
      `runNow:${JOB_KIND.rebuildScanBank}`,
      `runNow:${JOB_KIND.checkMatching}`,
    ]);
  });

  it("uses the dedicated routes for the scan bank and check matching buttons", async () => {
    await startJobFn({ data: { kind: JOB_KIND.rebuildScanBank } });
    await startJobFn({ data: { kind: JOB_KIND.checkMatching } });

    expect(calls).toEqual(["rebuildBank", "checkMatchingCandidates"]);
  });

  it("starts the manual-only passes through their own routes", async () => {
    await startJobFn({ data: { kind: JOB_KIND.refreshMatviews } });
    await startJobFn({ data: { kind: JOB_KIND.recomputeCardTokens } });
    await startJobFn({ data: { kind: JOB_KIND.backfillSiblingVariants } });

    expect(calls).toEqual(["refreshMatviews", "recomputeCardTokens", "backfillSiblingVariants"]);
  });

  it("runs a price refresh through the schedule's run-now", async () => {
    await startJobFn({ data: { kind: PRICE_REFRESH_JOB_KIND.cardmarket } });

    expect(calls).toEqual([`runNow:${PRICE_REFRESH_JOB_KIND.cardmarket}`]);
  });
});
