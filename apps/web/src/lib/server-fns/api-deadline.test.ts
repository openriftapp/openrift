import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_RETRY_BUDGET_MS, API_TIMEOUT_MS, fetchWithDeadline } from "./api-deadline";
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

  it("times out an admin write at the same 8 s deadline", async () => {
    vi.stubGlobal("fetch", hangingFetch());

    const settled = fetchWithDeadline(
      new Request("http://api:3000/api/admin/v1/x", { method: "POST" }),
      {},
      "",
    ).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS);

    expect(API_TIMEOUT_MS).toBe(8000);
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

function connectionError(code: string) {
  return Object.assign(new TypeError(`${code}: Unable to connect`), { code });
}

describe("fetchWithDeadline retries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EHOSTUNREACH"])(
    "retries a GET after %s and returns the next response",
    async (code) => {
      const response = new Response("{}");
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(connectionError(code))
        .mockResolvedValueOnce(response);
      vi.stubGlobal("fetch", fetchMock);

      const pending = fetchWithDeadline("http://api:3000/api/v1/x", {}, "t");
      await vi.advanceTimersByTimeAsync(100);

      await expect(pending).resolves.toBe(response);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(console.warn).toHaveBeenCalledOnce();
      expect(console.warn).toHaveBeenCalledWith(
        "[API retry] GET http://api:3000/api/v1/x answered after 1 retries",
      );
    },
  );

  it("rethrows the last connection error once the retry budget is spent", async () => {
    const error = connectionError("ECONNREFUSED");
    const fetchMock = vi.fn().mockRejectedValue(error);
    vi.stubGlobal("fetch", fetchMock);

    const settled = fetchWithDeadline("http://api:3000/api/v1/x", {}, "t").catch(
      (error_: unknown) => error_,
    );
    await vi.advanceTimersByTimeAsync(API_RETRY_BUDGET_MS);

    expect(await settled).toBe(error);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.warn).toHaveBeenCalledWith(
      "[API retry] GET http://api:3000/api/v1/x failed after 5 retries",
    );
  });

  it("does not retry a POST", async () => {
    const error = connectionError("ECONNREFUSED");
    const fetchMock = vi.fn().mockRejectedValue(error);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchWithDeadline(new Request("http://api:3000/api/v1/x", { method: "POST" }), {}, "t"),
    ).rejects.toBe(error);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("returns an HTTP 500 without retrying", async () => {
    const response = new Response("oops", { status: 500 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWithDeadline("http://api:3000/api/v1/x", {}, "t")).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects with the caller's abort reason during a retry backoff", async () => {
    const fetchMock = vi.fn().mockRejectedValue(connectionError("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);
    const caller = new AbortController();
    const reason = new Error("navigated away");

    const settled = fetchWithDeadline(
      "http://api:3000/api/v1/x",
      { signal: caller.signal },
      "",
    ).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(50);
    caller.abort(reason);

    expect(await settled).toBe(reason);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    expect(console.warn).toHaveBeenCalledWith(
      "[API retry] GET http://api:3000/api/v1/x failed after 1 retries",
    );
  });

  it("sends a hung GET once and fails it as a 504 at the 8 s deadline", async () => {
    const fetchMock = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);

    const settled = fetchWithDeadline("http://api:3000/api/v1/x", {}, "Couldn't load").catch(
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS);

    expect(errorStatus(await settled)).toBe(504);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("fails at the 8 s deadline when a retry hangs", async () => {
    const hang = hangingFetch();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(connectionError("ECONNREFUSED"))
      .mockImplementation(hang);
    vi.stubGlobal("fetch", fetchMock);

    const settled = fetchWithDeadline("http://api:3000/api/v1/x", {}, "t").catch(
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS);

    expect(errorStatus(await settled)).toBe(504);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(
      "[API retry] GET http://api:3000/api/v1/x failed after 1 retries",
    );
  });
});
