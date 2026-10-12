import type { QueryClient } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { hasSessionCookie, requireSession } from "./auth-session";

function guard(session: unknown, href = "/contribute") {
  const query = vi.fn().mockResolvedValue(session);
  const queryClient = { query } as unknown as QueryClient;
  return { query, result: requireSession({ context: { queryClient }, location: { href } }) };
}

describe("requireSession", () => {
  it("returns the signed-in user's id", async () => {
    const { result } = guard({ user: { id: "user-1" } });

    await expect(result).resolves.toEqual({ userId: "user-1" });
  });

  it("reads the cached session without refetching", async () => {
    const { query, result } = guard({ user: { id: "user-1" } });
    await result;

    expect(query).toHaveBeenCalledWith(expect.objectContaining({ staleTime: "static" }));
  });

  it("redirects a signed-out visitor to /login, returning to the current page", async () => {
    const { result } = guard(null, "/contribute/card?name=Jinx");
    const thrown: unknown = await result.catch((error: unknown) => error);

    expect(isRedirect(thrown)).toBe(true);
    expect(thrown).toMatchObject({
      options: { to: "/login", search: { redirect: "/contribute/card?name=Jinx" } },
    });
  });

  it("redirects a session without a user", async () => {
    const { result } = guard({ session: null, user: null });

    await expect(result).rejects.toSatisfy(isRedirect);
  });

  it("omits an empty redirect target", async () => {
    const { result } = guard(null, "");
    const thrown: unknown = await result.catch((error: unknown) => error);

    expect(thrown).toMatchObject({ options: { search: { redirect: undefined } } });
  });
});

describe("hasSessionCookie", () => {
  it("finds the production session cookie among others", () => {
    expect(hasSessionCookie("theme=dark; __Secure-better-auth.session_token=abc.def")).toBe(true);
  });

  it("finds the dev session cookie", () => {
    expect(hasSessionCookie("better-auth.session_token=abc")).toBe(true);
  });

  it("is false without any cookie", () => {
    expect(hasSessionCookie("")).toBe(false);
  });

  it("ignores other better-auth cookies and an empty session token", () => {
    expect(hasSessionCookie("better-auth.session_data=xyz; better-auth.session_token=")).toBe(
      false,
    );
  });

  it("ignores a cookie whose name only ends in the session token name", () => {
    expect(hasSessionCookie("other-better-auth.session_token=abc")).toBe(false);
  });
});
