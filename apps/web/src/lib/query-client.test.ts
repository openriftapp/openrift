// @vitest-environment jsdom
import { QueryObserver } from "@tanstack/react-query";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sessionQueryOptions } from "./auth-session";
import { createQueryClient } from "./query-client";
import { captureHandledError } from "./report-error";
import { notFoundError } from "./server-fns/api-error";
import { _resetReloadStateForTesting } from "./stale-bundle-reload";
import { loadSonner, PERSISTENT_ERROR_TOAST } from "./toast";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("./report-error", () => ({ captureHandledError: vi.fn() }));

const fetchFlags = vi.fn(() => Promise.resolve({}));
vi.mock("./feature-flags", () => ({
  featureFlagsQueryOptions: { queryKey: ["feature-flags"], queryFn: () => fetchFlags() },
}));

// Post-seroval-boundary ApiError: a plain object, prototype gone. instanceof fails here.
const unauthorized = {
  name: "ApiError",
  message: "Unauthorized",
  status: 401,
  diagnostic: "GET /api/v1/decks/1 → 401 Unauthorized\nUnauthorized",
} as unknown as Error;

// What getServerFnById throws when a manifest entry isn't on the deployed server.
const staleServerFn = {
  name: "Error",
  message: "Server function info not found for deadbeefcafef00d",
} as unknown as Error;

const reloadSpy = vi.fn();
beforeEach(() => {
  reloadSpy.mockReset();
  _resetReloadStateForTesting();
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { ...globalThis.location, reload: reloadSpy },
  });
});

describe("createQueryClient mutation onError", () => {
  function getOnError() {
    const onError = createQueryClient().getDefaultOptions().mutations?.onError;
    if (!onError) {
      throw new Error("expected a default mutation onError");
    }
    return onError as (err: unknown, ...rest: unknown[]) => void;
  }

  beforeEach(async () => {
    await loadSonner();
    vi.mocked(toast.error).mockClear();
    vi.mocked(captureHandledError).mockClear();
  });

  it("toasts the server message and logs the diagnostic for an ApiError-shaped object", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const serialized = {
      name: "ApiError",
      message: "Collection not found",
      code: "NOT_FOUND",
      diagnostic: "DELETE /api/v1/collections/1 → 404 Not Found\nCollection not found",
    };

    getOnError()(serialized, undefined, undefined);

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Collection not found", PERSISTENT_ERROR_TOAST),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Collection not found"),
      serialized,
    );
    errorSpy.mockRestore();
  });

  it("toasts a non-ApiError error's message and logs the error itself", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("network down");

    getOnError()(err, undefined, undefined);

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("network down", PERSISTENT_ERROR_TOAST),
    );
    expect(errorSpy).toHaveBeenCalledWith(err);
    errorSpy.mockRestore();
  });

  it("reloads instead of toasting when a mutation hits a stale server function", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    getOnError()(staleServerFn, undefined, undefined);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("reports a 5xx to Sentry", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    getOnError()(
      { name: "ApiError", message: "Internal error", status: 500, diagnostic: "" },
      undefined,
      undefined,
    );

    expect(captureHandledError).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("reports an error carrying no status to Sentry", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    getOnError()(new Error("boom"), undefined, undefined);

    expect(captureHandledError).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("does not report a 4xx to Sentry, since the toast already explains it", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    getOnError()(
      { name: "ApiError", message: "Input validation failed", status: 400, diagnostic: "" },
      undefined,
      undefined,
    );

    expect(toast.error).toHaveBeenCalledWith("Input validation failed", PERSISTENT_ERROR_TOAST);
    expect(captureHandledError).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("says the server cannot be reached instead of the browser's raw fetch failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    getOnError()(new TypeError("Failed to fetch"), undefined, undefined);

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Can't reach the server. Check your connection.",
        PERSISTENT_ERROR_TOAST,
      ),
    );
    errorSpy.mockRestore();
  });

  it("skips the toast for a mutation that shows its error inline, but still logs and reports it", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    getOnError()(new Error("boom"), undefined, undefined, { meta: { inlineError: true } });

    expect(toast.error).not.toHaveBeenCalled();
    expect(captureHandledError).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("still reloads on a stale server function when the error is shown inline", () => {
    getOnError()(staleServerFn, undefined, undefined, { meta: { inlineError: true } });

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("invalidates the session query when a mutation fails with a 401", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = createQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries").mockResolvedValue();
    const onError = client.getDefaultOptions().mutations?.onError as (
      err: unknown,
      ...rest: unknown[]
    ) => void;

    onError(unauthorized, undefined, undefined);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sessionQueryOptions().queryKey });
    errorSpy.mockRestore();
  });
});

describe("createQueryClient session-expiry handling", () => {
  it("invalidates the session query when a query fails with a 401", async () => {
    const client = createQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries").mockResolvedValue();

    await expect(
      client.query({
        queryKey: ["deck", "1"],
        queryFn: () => Promise.reject(unauthorized),
      }),
    ).rejects.toBe(unauthorized);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sessionQueryOptions().queryKey });
  });

  it("refetches the viewer's feature flags when a query fails with a 401", async () => {
    const client = createQueryClient();
    fetchFlags.mockClear();

    await expect(
      client.query({
        queryKey: ["deck", "3"],
        queryFn: () => Promise.reject(unauthorized),
      }),
    ).rejects.toBe(unauthorized);

    expect(fetchFlags).toHaveBeenCalledTimes(1);
  });

  it("does not refetch the flags when the flag query itself fails with a 401", async () => {
    const client = createQueryClient();
    fetchFlags.mockClear();

    await expect(
      client.query({
        queryKey: ["feature-flags"],
        queryFn: () => Promise.reject(unauthorized),
      }),
    ).rejects.toBe(unauthorized);

    expect(fetchFlags).not.toHaveBeenCalled();
  });

  it("does not invalidate the session for non-401 query errors", async () => {
    const client = createQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries").mockResolvedValue();
    const serverError = new Error("boom");

    await expect(
      client.query({
        queryKey: ["deck", "2"],
        queryFn: () => Promise.reject(serverError),
        retry: false,
      }),
    ).rejects.toBe(serverError);

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("reloads when a query (e.g. a poll) hits a stale server function", async () => {
    const client = createQueryClient();

    await expect(
      client.query({
        queryKey: ["deck-check", "entries"],
        queryFn: () => Promise.reject(staleServerFn),
        retry: false,
      }),
    ).rejects.toBe(staleServerFn);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("never retries a 401 or a stale server function but keeps 3 browser retries otherwise", () => {
    const retry = getRetry();

    expect(retry(0, unauthorized)).toBe(false);
    expect(retry(0, staleServerFn)).toBe(false);
    expect(retry(0, new Error("boom"))).toBe(true);
    expect(retry(2, new Error("boom"))).toBe(true);
    expect(retry(3, new Error("boom"))).toBe(false);
  });

  it("does not retry a server function's 404, so a stale link reaches notFoundComponent at once", () => {
    const retry = getRetry();

    expect(retry(0, notFoundError())).toBe(false);
  });

  it("does not retry a 400 or a 403", () => {
    const retry = getRetry();

    expect(retry(0, { name: "ApiError", message: "Bad input", status: 400 })).toBe(false);
    expect(retry(0, { name: "Error", message: "Forbidden", status: 403 })).toBe(false);
  });

  it("retries a 429 up to three times, so a rate limit that lifts recovers on its own", () => {
    const retry = getRetry();
    const rateLimited = { name: "ApiError", message: "Too many requests", status: 429 };

    expect(retry(0, rateLimited)).toBe(true);
    expect(retry(2, rateLimited)).toBe(true);
    expect(retry(3, rateLimited)).toBe(false);
  });

  it("still retries a 5xx and a network failure up to three times", () => {
    const retry = getRetry();
    const serverError = { name: "ApiError", message: "Internal error", status: 500 };
    const networkError = new TypeError("Failed to fetch");

    expect(retry(0, serverError)).toBe(true);
    expect(retry(2, serverError)).toBe(true);
    expect(retry(3, serverError)).toBe(false);
    expect(retry(2, networkError)).toBe(true);
  });
});

describe("createQueryClient staleTime default", () => {
  it("serves data younger than 30 s without fetching again", async () => {
    const client = createQueryClient();
    client.setQueryData(["fresh"], "hydrated");
    const queryFn = vi.fn(() => Promise.resolve("refetched"));

    await expect(client.query({ queryKey: ["fresh"], queryFn })).resolves.toBe("hydrated");
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("fetches again once the data is older than 30 s", async () => {
    const client = createQueryClient();
    client.setQueryData(["old"], "hydrated", { updatedAt: Date.now() - 31_000 });
    const queryFn = vi.fn(() => Promise.resolve("refetched"));

    await expect(client.query({ queryKey: ["old"], queryFn })).resolves.toBe("refetched");
  });

  it("still refetches a fresh, observed query when a mutation invalidates it", async () => {
    const client = createQueryClient();
    client.setQueryData(["observed"], "hydrated");
    const queryFn = vi.fn(() => Promise.resolve("refetched"));
    const observer = new QueryObserver(client, { queryKey: ["observed"], queryFn });
    const unsubscribe = observer.subscribe(() => {});
    expect(queryFn).not.toHaveBeenCalled();

    await client.invalidateQueries({ queryKey: ["observed"] });

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(["observed"])).toBe("refetched");
    unsubscribe();
  });
});

function getRetry() {
  return createQueryClient().getDefaultOptions().queries?.retry as (
    failureCount: number,
    error: unknown,
  ) => boolean;
}
