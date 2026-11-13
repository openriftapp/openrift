import { describe, expect, it } from "vitest";

import { jobRunsSearchSchema } from "./admin-job-runs-search";

describe("jobRunsSearchSchema", () => {
  it("accepts an untouched tab as an empty search", () => {
    expect(jobRunsSearchSchema.parse({})).toEqual({});
  });

  it("ignores the unprefixed status the cards tab owns", () => {
    expect(jobRunsSearchSchema.parse({ status: "failed" })).toEqual({});
  });

  it("coerces the page number out of the URL string", () => {
    expect(jobRunsSearchSchema.parse({ page: "2" }).page).toBe(2);
  });

  it("falls back to the default for a page below one", () => {
    expect(jobRunsSearchSchema.parse({ page: "0", runKind: "kept" })).toEqual({ runKind: "kept" });
  });

  it("falls back to the default for a fractional page", () => {
    expect(jobRunsSearchSchema.parse({ page: "2.5", runKind: "kept" })).toEqual({
      runKind: "kept",
    });
  });

  it("accepts every trigger", () => {
    for (const runTrigger of ["cron", "admin", "api"]) {
      expect(jobRunsSearchSchema.parse({ runTrigger }).runTrigger).toBe(runTrigger);
    }
  });

  it("falls back to the default for an unknown trigger", () => {
    expect(jobRunsSearchSchema.parse({ runTrigger: "manual", runKind: "kept" })).toEqual({
      runKind: "kept",
    });
  });

  it("accepts every status", () => {
    for (const runStatus of ["running", "succeeded", "failed"]) {
      expect(jobRunsSearchSchema.parse({ runStatus }).runStatus).toBe(runStatus);
    }
  });

  it("falls back to the default for an unknown status", () => {
    expect(jobRunsSearchSchema.parse({ runStatus: "pending", runKind: "kept" })).toEqual({
      runKind: "kept",
    });
  });

  it("accepts every activity", () => {
    for (const runActivity of ["did-work", "noop"]) {
      expect(jobRunsSearchSchema.parse({ runActivity }).runActivity).toBe(runActivity);
    }
  });

  it("falls back to the default for an unknown activity", () => {
    expect(jobRunsSearchSchema.parse({ runActivity: "skipped", runKind: "kept" })).toEqual({
      runKind: "kept",
    });
  });

  it("passes the kind and prefix through untouched", () => {
    expect(jobRunsSearchSchema.parse({ runKind: "price-refresh", runPrefix: "price" })).toEqual({
      runKind: "price-refresh",
      runPrefix: "price",
    });
  });
});
