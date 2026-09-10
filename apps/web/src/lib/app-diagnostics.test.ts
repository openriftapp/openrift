import { QueryClient } from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      middleware: () => chain,
      validator: () => chain,
      handler: () => () => undefined,
    };
    return chain;
  },
  createMiddleware: () => {
    const chain = { server: () => chain };
    return chain;
  },
}));

vi.mock("./server-fns/middleware", () => ({ withCookies: () => {} }));
vi.mock("./server-fns/fetch-api", () => ({ fetchApi: vi.fn() }));

const { getAppDiagnostics, markHydrationSettled, setDiagnosticsSources } =
  await import("./app-diagnostics");
const { sessionQueryOptions } = await import("./auth-session");

const SESSION_KEY = sessionQueryOptions().queryKey;

const SESSION = {
  session: { id: "s1", userId: "u1", expiresAt: "2030-01-01T00:00:00.000Z", token: "t1" },
  user: {
    id: "u1",
    name: "Summoner Kai",
    email: "kai@example.com",
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

function fakeRouter(pathname: string, routeIds: string[]): AnyRouter {
  return {
    state: {
      location: { pathname },
      matches: routeIds.map((routeId) => ({ routeId })),
    },
  } as unknown as AnyRouter;
}

let client: QueryClient;

beforeEach(() => {
  client = new QueryClient();
  setDiagnosticsSources({
    queryClient: client,
    router: fakeRouter("/collections", ["__root__", "/_app", "/_app/_authenticated"]),
  });
});

describe("getAppDiagnostics", () => {
  it("reports the route and the query cache size", () => {
    client.setQueryData(["cards"], []);

    const diagnostics = getAppDiagnostics();

    expect(diagnostics.pathname).toBe("/collections");
    expect(diagnostics.matchedRouteIds).toBe("__root__ /_app /_app/_authenticated");
    expect(diagnostics.queryCount).toBe(1);
  });

  it("reports an absent session query, the state that hid the /collections crash", () => {
    expect(getAppDiagnostics().sessionState).toBe("absent");
  });

  it("distinguishes a signed-out session from a signed-in one", () => {
    client.setQueryData(SESSION_KEY, null);
    expect(getAppDiagnostics().sessionState).toBe("null");

    client.setQueryData(SESSION_KEY, SESSION);
    expect(getAppDiagnostics().sessionState).toBe("user");
  });

  it("carries the hydration flag", () => {
    markHydrationSettled();
    expect(getAppDiagnostics().hydrationSettled).toBe(true);
  });
});
