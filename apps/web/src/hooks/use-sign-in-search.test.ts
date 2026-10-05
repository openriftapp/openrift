import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const location = vi.hoisted(() => ({ href: "/meta/summoner-skirmish?tab=decks" }));

vi.mock("@tanstack/react-router", () => ({
  useLocation: ({ select }: { select: (value: { href: string }) => string }) => select(location),
}));

const { useSignInSearch } = await import("./use-sign-in-search");

afterEach(() => {
  location.href = "/meta/summoner-skirmish?tab=decks";
});

describe("useSignInSearch", () => {
  it("links to /login with the current page as the redirect", () => {
    const { result } = renderHook(() => useSignInSearch());

    expect(result.current).toEqual({
      to: "/login",
      search: { redirect: "/meta/summoner-skirmish?tab=decks", email: undefined },
    });
  });

  it("omits an empty redirect", () => {
    location.href = "";
    const { result } = renderHook(() => useSignInSearch());

    expect(result.current.search.redirect).toBeUndefined();
  });
});
