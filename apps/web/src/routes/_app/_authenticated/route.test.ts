import type { AdminMeResponse } from "@openrift/shared/contracts/admin/core";
import { QueryClient, queryOptions } from "@tanstack/react-query";
import type { AnyRedirect } from "@tanstack/react-router";
import { isRedirect } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({
  fetch: vi.fn<() => Promise<AdminMeResponse>>(),
}));

vi.mock("@/features/admin/lib/admin-queries", () => ({
  adminAccessQueryOptions: (userId: string | null) =>
    queryOptions({ queryKey: ["admin", "me", userId], queryFn: () => access.fetch() }),
}));

const { Route: AuthenticatedRoute } = await import("./route");
const { Route: AdminRoute } = await import("./admin/route");

type Hook = (ctx: Record<string, unknown>) => Promise<unknown>;
const authenticatedGate = AuthenticatedRoute.options.beforeLoad as unknown as Hook;
const adminGate = AdminRoute.options.beforeLoad as unknown as Hook;

function signedIn(queryClient: QueryClient) {
  queryClient.setQueryData(["session"], { user: { id: "user-1" } });
}

async function thrownBy(run: () => Promise<unknown>): Promise<AnyRedirect> {
  try {
    await run();
  } catch (error) {
    expect(isRedirect(error)).toBe(true);
    return error as AnyRedirect;
  }
  throw new Error("nothing was thrown");
}

function location(pathname: string) {
  return { pathname, href: pathname };
}

describe("the signed-in layout on the server", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    access.fetch.mockReset();
  });

  it("lets an admin through, and the browser's admin gate asks for access no second time", async () => {
    signedIn(queryClient);
    access.fetch.mockResolvedValue({ isAdmin: true, sections: [] });

    await expect(
      authenticatedGate({ context: { queryClient }, location: location("/admin/cards") }),
    ).resolves.toEqual({ userId: "user-1" });
    await adminGate({
      context: { queryClient, userId: "user-1" },
      location: location("/admin/cards"),
    });

    expect(access.fetch).toHaveBeenCalledOnce();
  });

  it("redirects a signed-in non-admin to the cards before any admin HTML", async () => {
    signedIn(queryClient);
    access.fetch.mockResolvedValue({ isAdmin: false, sections: [] });

    const thrown = await thrownBy(() =>
      authenticatedGate({ context: { queryClient }, location: location("/admin") }),
    );

    expect(thrown.options).toMatchObject({ to: "/cards" });
  });

  it("sends a signed-out visitor to sign in without asking for admin access", async () => {
    queryClient.setQueryData(["session"], null);

    const thrown = await thrownBy(() =>
      authenticatedGate({ context: { queryClient }, location: location("/admin") }),
    );

    expect(thrown.options).toMatchObject({ to: "/login", search: { redirect: "/admin" } });
    expect(access.fetch).not.toHaveBeenCalled();
  });

  it("asks for no admin access outside /admin", async () => {
    signedIn(queryClient);

    await expect(
      authenticatedGate({ context: { queryClient }, location: location("/administrators") }),
    ).resolves.toEqual({ userId: "user-1" });

    expect(access.fetch).not.toHaveBeenCalled();
  });
});
