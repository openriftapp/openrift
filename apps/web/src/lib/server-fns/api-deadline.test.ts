import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_TIMEOUT_MS, fetchWithDeadline } from "./api-deadline";
import { errorStatus, isApiError } from "./api-error";

function hangingFetch() {
  return vi.fn(async (_input: string | Request, init?: RequestInit): Promise<Response> => {
    const signal = init!.signal!;
    await new Promise((resolve) => {
      signal.addEventListener("abort", resolve);
    });
    throw signal.reason as Error;
  });
}

describe("fetchWithDeadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects with a 504 ApiError when the API sends nothing within the deadline", async () => {
    vi.stubGlobal("fetch", hangingFetch());

    const pending = fetchWithDeadline(
      "http://api:3000/api/v1/x",
      { method: "GET" },
      "Couldn't load",
    );
    const settled = pending.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS);
    const error = await settled;

    expect(isApiError(error)).toBe(true);
    expect(errorStatus(error)).toBe(504);
    expect((error as Error).message).toBe("Couldn't load");
    expect((error as { diagnostic: string }).diagnostic).toContain("GET http://api:3000/api/v1/x");
  });

  it("times out an admin write at the same 15 s deadline", async () => {
    vi.stubGlobal("fetch", hangingFetch());

    const settled = fetchWithDeadline(
      new Request("http://api:3000/api/admin/v1/x", { method: "POST" }),
      {},
      "",
    ).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS);

    expect(API_TIMEOUT_MS).toBe(15_000);
    expect(errorStatus(await settled)).toBe(504);
  });

  it("returns the response and clears the timer when the API answers in time", async () => {
    const response = new Response("{}");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(fetchWithDeadline("http://api:3000/api/v1/x", {}, "t")).resolves.toBe(response);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("passes a network error through unchanged", async () => {
    const networkError = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(networkError));

    await expect(fetchWithDeadline("http://api:3000/api/v1/x", {}, "t")).rejects.toBe(networkError);
  });

  it("rejects with the caller's own abort reason, not a 504", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const caller = new AbortController();
    const reason = new Error("navigated away");

    const settled = fetchWithDeadline(
      new Request("http://api:3000/api/v1/x", { signal: caller.signal }),
      {},
      "",
    ).catch((error: unknown) => error);
    caller.abort(reason);

    expect(await settled).toBe(reason);
  });

  it("uses the Request's method in the diagnostic", async () => {
    vi.stubGlobal("fetch", hangingFetch());

    const settled = fetchWithDeadline(
      new Request("http://api:3000/api/v1/x", { method: "POST" }),
      {},
      "",
    ).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS);

    expect(((await settled) as { diagnostic: string }).diagnostic).toContain("POST ");
  });
});
