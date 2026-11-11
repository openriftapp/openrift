import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionExpiredRedirect } from "./use-session-expired-redirect";

const { navigateMock, sessionState, locationState } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  sessionState: { data: undefined as unknown },
  locationState: { href: "/decks/abc", pathname: "/decks/abc" },
}));

const PUBLIC_PATHS = new Set(["/cards"]);

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ href: locationState.href, pathname: locationState.pathname }),
  useRouter: () => ({
    getMatchedRoutes: (pathname: string) => [
      PUBLIC_PATHS.has(pathname)
        ? [{ id: "__root__" }, { id: "/_app" }, { id: "/_app/cards" }]
        : [{ id: "__root__" }, { id: "/_app" }, { id: "/_app/_authenticated" }],
    ],
  }),
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ data: sessionState.data }),
}));

describe("useSessionExpiredRedirect", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    sessionState.data = undefined;
    locationState.href = "/decks/abc";
    locationState.pathname = "/decks/abc";
  });

  it("does nothing while the session query has not resolved (undefined)", () => {
    const { result } = renderHook(() => useSessionExpiredRedirect());

    expect(result.current).toBe(false);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("does nothing for an authenticated session", () => {
    sessionState.data = { user: { id: "user-1" } };

    const { result } = renderHook(() => useSessionExpiredRedirect());

    expect(result.current).toBe(false);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("redirects to /login with the current location once the session is null", () => {
    sessionState.data = null;

    const { result } = renderHook(() => useSessionExpiredRedirect());

    expect(result.current).toBe(true);
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/login",
      search: { redirect: "/decks/abc", email: undefined },
    });
  });

  it("redirects when the session expires after mount", () => {
    sessionState.data = { user: { id: "user-1" } };
    const { result, rerender } = renderHook(() => useSessionExpiredRedirect());
    expect(navigateMock).not.toHaveBeenCalled();

    sessionState.data = null;
    rerender();

    expect(result.current).toBe(true);
    expect(navigateMock).toHaveBeenCalledTimes(1);
  });

  it("redirects only once when the href changes as a result of navigating", () => {
    sessionState.data = null;
    const { rerender } = renderHook(() => useSessionExpiredRedirect());
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/login",
      search: { redirect: "/decks/abc", email: undefined },
    });

    locationState.href = "/login?redirect=/decks/abc";
    rerender();
    locationState.href = "/login?redirect=/login";
    rerender();

    expect(navigateMock).toHaveBeenCalledTimes(1);
  });

  it("redirects again on a fresh expiry after the session comes back", () => {
    sessionState.data = null;
    const { rerender } = renderHook(() => useSessionExpiredRedirect());
    expect(navigateMock).toHaveBeenCalledTimes(1);

    sessionState.data = { user: { id: "user-1" } };
    rerender();
    sessionState.data = null;
    rerender();

    expect(navigateMock).toHaveBeenCalledTimes(2);
  });

  it("omits the redirect param when the current href is empty", () => {
    sessionState.data = null;
    locationState.href = "";

    renderHook(() => useSessionExpiredRedirect());

    expect(navigateMock).toHaveBeenCalledWith({
      to: "/login",
      search: { redirect: undefined, email: undefined },
    });
  });

  it("does not redirect while the router is already leaving for a public page", () => {
    sessionState.data = { user: { id: "user-1" } };
    const { result, rerender } = renderHook(() => useSessionExpiredRedirect());

    locationState.href = "/cards";
    locationState.pathname = "/cards";
    sessionState.data = null;
    rerender();

    expect(result.current).toBe(true);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
