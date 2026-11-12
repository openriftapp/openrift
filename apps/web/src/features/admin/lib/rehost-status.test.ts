import { describe, expect, it } from "vitest";

import { rehostStatus, rehostStatusTitle } from "./rehost-status";

const FAILURE = { attempts: 3, error: "HTTP 404", lastAttemptAt: "2026-11-12T10:00:00.000Z" };

describe("rehostStatus", () => {
  it("is rehosted once the file has a rehosted URL, whatever else is set", () => {
    expect(
      rehostStatus({
        rehostedUrl: "/media/cards/ab/x",
        activateWhenRehosted: true,
        rehostFailure: FAILURE,
      }),
    ).toBe("rehosted");
  });

  it("reports a recorded failure before the pending flag", () => {
    expect(
      rehostStatus({ rehostedUrl: null, activateWhenRehosted: true, rehostFailure: FAILURE }),
    ).toBe("failed");
  });

  it("is pending while a main image waits for its first rehost", () => {
    expect(
      rehostStatus({ rehostedUrl: null, activateWhenRehosted: true, rehostFailure: null }),
    ).toBe("pending");
  });

  it("is not-rehosted for an extra image nobody asked to activate", () => {
    expect(
      rehostStatus({ rehostedUrl: null, activateWhenRehosted: false, rehostFailure: null }),
    ).toBe("not-rehosted");
  });
});

describe("rehostStatusTitle", () => {
  it("names the error and attempt count of a failed rehost", () => {
    expect(
      rehostStatusTitle({ rehostedUrl: null, activateWhenRehosted: false, rehostFailure: FAILURE }),
    ).toBe("Copy to our server failed after 3 attempts: HTTP 404.");
  });

  it("says a failed pending image still activates once a retry succeeds", () => {
    expect(
      rehostStatusTitle({
        rehostedUrl: null,
        activateWhenRehosted: true,
        rehostFailure: { ...FAILURE, attempts: 1 },
      }),
    ).toBe(
      "Copy to our server failed after 1 attempt: HTTP 404. It becomes the active image once a retry succeeds.",
    );
  });
});
