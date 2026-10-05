import { keepPreviousData } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { JobRunsQueryParams } from "./job-runs-queries";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler: (fn: (...args: unknown[]) => unknown) => fn,
      validator: () => chain,
      middleware: () => chain,
    };
    return chain;
  },
  createMiddleware: () => ({ server: (fn: (...args: unknown[]) => unknown) => fn }),
}));

const { adminJobRunsQueryOptions, JOB_RUNS_PAGE_SIZE, latestJobRunQueryOptions } =
  await import("./job-runs-queries");

describe("adminJobRunsQueryOptions", () => {
  it("encodes the page and filters into the query key", () => {
    const params = {
      page: 3,
      kind: "images.regenerate",
      trigger: "cron",
      status: "failed",
    } satisfies JobRunsQueryParams;
    expect(adminJobRunsQueryOptions(params).queryKey).toEqual([
      "admin",
      "job-runs",
      "list",
      params,
    ]);
  });

  it("auto-refreshes only on the first page", () => {
    expect(adminJobRunsQueryOptions({ page: 1 }).refetchInterval).toBe(15_000);
    expect(adminJobRunsQueryOptions({ page: 2 }).refetchInterval).toBe(false);
  });

  it("keeps the previous page on screen while the next loads", () => {
    expect(adminJobRunsQueryOptions({ page: 2 }).placeholderData).toBe(keepPreviousData);
  });

  it("exposes a fixed page size", () => {
    expect(JOB_RUNS_PAGE_SIZE).toBe(50);
  });
});

describe("latestJobRunQueryOptions", () => {
  function intervalFor(status: string | undefined) {
    const refetchInterval = latestJobRunQueryOptions("tcgplayer.refresh").refetchInterval;
    if (typeof refetchInterval !== "function") {
      throw new TypeError("expected a refetchInterval function");
    }
    const query = { state: { data: status === undefined ? null : { status } } };
    return refetchInterval(query as never);
  }

  it("keys the run by job kind under the shared job-runs prefix", () => {
    expect(latestJobRunQueryOptions("tcgplayer.refresh").queryKey).toEqual([
      "admin",
      "job-runs",
      "by-kind",
      "tcgplayer.refresh",
    ]);
  });

  it("polls fast while the run is going", () => {
    expect(intervalFor("running")).toBe(2000);
  });

  it("polls slowly once the run has finished or before any run exists", () => {
    expect(intervalFor("succeeded")).toBe(60_000);
    expect(intervalFor("failed")).toBe(60_000);
    expect(intervalFor(undefined)).toBe(60_000);
  });
});
