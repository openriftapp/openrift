import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MetaDateRange } from "@/features/meta/lib/meta-scope";
import { isRetryableError } from "@/lib/server-fns/api-error";

// No TanStack Start server in vitest; run the handler directly with a synthetic
// context so `context.cookie` reads work without withCookies.
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler:
        (fn: (input: Record<string, unknown>) => unknown) => (input?: Record<string, unknown>) =>
          fn({ context: { cookie: "" }, ...input }),
      middleware: () => chain,
      validator: () => chain,
    };
    return chain;
  },
  createMiddleware: () => {
    const chain = { server: () => chain, client: () => chain };
    return chain;
  },
}));

const event = vi.fn();
const standings = vi.fn();

vi.mock("@/lib/server-fns/orpc-client", () => ({
  apiOrpcClient: () => ({ event, standings }),
}));

const { serverCache } = await import("@/lib/server-cache");
const { metaEventQueryOptions, metaStandingsQueryOptions, optionalQuery } =
  await import("./meta-queries");

describe("optionalQuery", () => {
  it("resolves a payload-less call to an empty query", () => {
    expect(optionalQuery<MetaDateRange>()).toEqual({});
  });

  it("resolves an explicit undefined to an empty query", () => {
    expect(optionalQuery<MetaDateRange>(undefined)).toEqual({});
  });

  it("passes a query through untouched", () => {
    const range = { from: "2026-08-01", to: "2026-08-31" };
    expect(optionalQuery<MetaDateRange>(range)).toBe(range);
  });
});

describe("metaEventQueryOptions on a missing event", () => {
  beforeEach(() => {
    event.mockReset();
    event.mockRejectedValue(new ORPCError("NOT_FOUND", { defined: true }));
  });

  function runQuery() {
    const { queryFn } = metaEventQueryOptions("gone");
    return (queryFn as () => Promise<unknown>)();
  }

  it("rejects with the NOT_FOUND message the route loader matches on", async () => {
    await expect(runQuery()).rejects.toThrow("NOT_FOUND");
    await expect(runQuery()).rejects.toBeInstanceOf(Error);
  });

  it("attaches status 404, so the browser retry predicate declines it", async () => {
    const caught = await runQuery().catch((error: unknown) => error);

    expect((caught as { status?: number }).status).toBe(404);
    expect(isRetryableError(caught)).toBe(false);
  });

  it("rethrows a 5xx unchanged, so it keeps its retries", async () => {
    event.mockReset();
    event.mockRejectedValue(new ORPCError("INTERNAL_SERVER_ERROR"));

    const caught = await runQuery().catch((error: unknown) => error);

    expect((caught as { status?: number }).status).toBe(500);
    expect(isRetryableError(caught)).toBe(true);
  });
});

describe("metaStandingsQueryOptions through the server cache", () => {
  beforeEach(() => {
    standings.mockReset();
    serverCache.clear();
  });

  function runQuery() {
    const { queryFn } = metaStandingsQueryOptions("gone");
    return (queryFn as () => Promise<unknown>)();
  }

  it("maps a 404 to the NOT_FOUND sentinel and carries it out of the cache unchanged", async () => {
    standings.mockRejectedValue(new ORPCError("NOT_FOUND", { defined: true }));

    const caught = await runQuery().catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("NOT_FOUND");
    expect((caught as { status?: number }).status).toBe(404);
  });

  it("refetches after a rejection instead of serving the cached failure", async () => {
    standings.mockRejectedValueOnce(new ORPCError("INTERNAL_SERVER_ERROR"));
    standings.mockResolvedValueOnce({ standings: [], total: 0 });

    await expect(runQuery()).rejects.toThrow();
    await expect(runQuery()).resolves.toEqual({ standings: [], total: 0 });
    expect(standings).toHaveBeenCalledTimes(2);
  });

  it("serves a second read of the same query from the cache", async () => {
    standings.mockResolvedValue({ standings: [], total: 0 });

    await runQuery();
    await runQuery();

    expect(standings).toHaveBeenCalledTimes(1);
  });
});
