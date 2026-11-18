import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";
import { isNotFound } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-cache", async () => {
  const { QueryClient: QC } = await import("@tanstack/react-query");
  return { serverCache: new QC({ defaultOptions: { queries: { retry: false } } }) };
});

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      middleware: () => chain,
      handler: (fn: (input: { context: { cookie: string } }) => unknown) => (): unknown =>
        fn({ context: { cookie: "" } }),
    };
    return chain;
  },
}));

vi.mock("./server-fns/middleware", () => ({ withCookies: () => undefined }));

// Must import after mocks so they take effect.
const {
  FeatureFlagsUnavailableError,
  featureFlagsQueryOptions,
  featureFlagsUnknown,
  loadFeatureFlags,
  prefetchFeatureFlags,
  refetchUnknownFeatureFlags,
  requireFeature,
} = await import("./feature-flags");
const { serverCache } = (await import("./server-cache")) as { serverCache: QueryClient };

const SESSION_COOKIE = "better-auth.session_token=abc123; theme=dark";
const NO_SESSION_COOKIE = "theme=dark";

/**
 * The oRPC OpenAPI client reads the response content-type and streams the
 * body, so the mock must be a real Response, not a hand-rolled stub.
 */
function mockFlagsResponse(flags: Record<string, boolean>) {
  return Response.json({ flags });
}

/** oRPC's fetch link may call fetch as `fetch(url, init)` or `fetch(request)`. */
function readFetchCall(call: unknown[]): { url: string; headers: Headers } {
  const [first, second] = call;
  if (first instanceof Request) {
    return { url: first.url, headers: first.headers };
  }
  const init = (second ?? {}) as { headers?: HeadersInit };
  return { url: String(first), headers: new Headers(init.headers) };
}

describe("loadFeatureFlags", () => {
  beforeEach(() => {
    serverCache.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards the session cookie to the API when authenticated", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFlagsResponse({ "beta-flag": true }));
    vi.stubGlobal("fetch", fetchMock);

    const flags = await loadFeatureFlags(SESSION_COOKIE);

    expect(flags).toEqual({ "beta-flag": true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, headers } = readFetchCall(fetchMock.mock.calls[0]!);
    expect(url).toBe("http://localhost:3000/api/v1/feature-flags");
    expect(headers.get("cookie")).toBe(SESSION_COOKIE);
  });

  it("bypasses the shared serverCache for authenticated users so overrides don't leak between accounts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockFlagsResponse({ a: true }))
      .mockResolvedValueOnce(mockFlagsResponse({ b: true }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await loadFeatureFlags("better-auth.session_token=user-a");
    const second = await loadFeatureFlags("better-auth.session_token=user-b");

    expect(first).toEqual({ a: true });
    expect(second).toEqual({ b: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not forward cookies when no session cookie is present", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFlagsResponse({ "public-flag": true }));
    vi.stubGlobal("fetch", fetchMock);

    await loadFeatureFlags(NO_SESSION_COOKIE);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { headers } = readFetchCall(fetchMock.mock.calls[0]!);
    expect(headers.get("cookie")).toBeNull();
  });

  it("coalesces concurrent anonymous requests via serverCache", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFlagsResponse({ "public-flag": true }));
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([loadFeatureFlags(""), loadFeatureFlags("")]);

    expect(a).toEqual({ "public-flag": true });
    expect(b).toEqual({ "public-flag": true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("requireFeature", () => {
  function clientWithFlags(flags: Record<string, boolean>): QueryClient {
    const queryClient = new QueryClient();
    queryClient.setQueryData(featureFlagsQueryOptions.queryKey, flags);
    return queryClient;
  }

  it("lets the route load while the feature is on", async () => {
    await expect(
      requireFeature(clientWithFlags({ scanner: true }), "scanner"),
    ).resolves.toBeUndefined();
  });

  it("shows the not-found page while the feature is off", async () => {
    const thrown = await requireFeature(clientWithFlags({ scanner: false }), "scanner").catch(
      (error: unknown) => error,
    );

    expect(isNotFound(thrown)).toBe(true);
  });

  it("shows the not-found page when the API sent no such flag", async () => {
    const thrown = await requireFeature(clientWithFlags({}), "glossary").catch(
      (error: unknown) => error,
    );

    expect(isNotFound(thrown)).toBe(true);
  });
});

describe("flags after a failed fetch", () => {
  beforeEach(() => {
    serverCache.clear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubBrowser(): void {
    vi.stubGlobal("window", {});
    vi.stubGlobal("location", { origin: "http://localhost:3000" });
  }

  async function clientAfterFailedFetch(): Promise<QueryClient> {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await prefetchFeatureFlags(queryClient);
    serverCache.clear();
    return queryClient;
  }

  it("renders with every flag off and marks the flags unknown", async () => {
    const queryClient = await clientAfterFailedFetch();

    expect(queryClient.getQueryData(featureFlagsQueryOptions.queryKey)).toEqual({});
    expect(featureFlagsUnknown(queryClient)).toBe(true);
  });

  it("keeps the flags unknown across dehydration into the browser", async () => {
    const browserClient = new QueryClient();
    hydrate(browserClient, dehydrate(await clientAfterFailedFetch()));

    expect(browserClient.getQueryData(featureFlagsQueryOptions.queryKey)).toEqual({});
    expect(featureFlagsUnknown(browserClient)).toBe(true);
  });

  it("knows flags that loaded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockFlagsResponse({ scanner: true })));
    const queryClient = new QueryClient();

    await prefetchFeatureFlags(queryClient);

    expect(featureFlagsUnknown(queryClient)).toBe(false);
  });

  it("answers a flagged page on the server with a retryable error, not a 404", async () => {
    const queryClient = await clientAfterFailedFetch();

    const thrown = await requireFeature(queryClient, "scanner").catch((error: unknown) => error);

    expect(isNotFound(thrown)).toBe(false);
    expect(thrown).toBeInstanceOf(FeatureFlagsUnavailableError);
  });

  it("refetches unknown flags in the browser before deciding", async () => {
    const queryClient = await clientAfterFailedFetch();
    stubBrowser();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockFlagsResponse({ scanner: true })));

    await expect(requireFeature(queryClient, "scanner")).resolves.toBeUndefined();
    expect(featureFlagsUnknown(queryClient)).toBe(false);
  });

  it("throws the fetch error in the browser while the flags stay unreachable", async () => {
    const queryClient = await clientAfterFailedFetch();
    stubBrowser();

    const thrown = await requireFeature(queryClient, "scanner").catch((error: unknown) => error);

    expect(isNotFound(thrown)).toBe(false);
    expect(thrown).toBeInstanceOf(Error);
    expect(queryClient.getQueryData(featureFlagsQueryOptions.queryKey)).toEqual({});
    expect(featureFlagsUnknown(queryClient)).toBe(true);
  });

  it("refetches unknown flags after hydration", async () => {
    const queryClient = await clientAfterFailedFetch();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockFlagsResponse({ glossary: true })));

    await refetchUnknownFeatureFlags(queryClient);

    expect(queryClient.getQueryData(featureFlagsQueryOptions.queryKey)).toEqual({
      glossary: true,
    });
  });

  it("keeps rendering with flags off when the refetch after hydration fails", async () => {
    const queryClient = await clientAfterFailedFetch();

    await expect(refetchUnknownFeatureFlags(queryClient)).resolves.toBeUndefined();
    expect(queryClient.getQueryData(featureFlagsQueryOptions.queryKey)).toEqual({});
    expect(featureFlagsUnknown(queryClient)).toBe(true);
  });

  it("leaves known flags alone after hydration", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient();
    queryClient.setQueryData(featureFlagsQueryOptions.queryKey, { glossary: true });

    await refetchUnknownFeatureFlags(queryClient);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
