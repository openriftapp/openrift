import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sessionQueryOptions } from "./auth-session";
import { featureFlagsQueryOptions } from "./feature-flags";
import { isSignedOutViewerQuery, refreshViewer, refreshViewerAfterSignOut } from "./viewer-change";

const fetchFlags = vi.fn();

vi.mock("./feature-flags", () => ({
  featureFlagsQueryOptions: {
    queryKey: ["feature-flags"],
    queryFn: () => fetchFlags(),
    staleTime: 5 * 60 * 1000,
  },
}));

function readFlagsLikeAGuard(client: QueryClient) {
  return client.query({ ...featureFlagsQueryOptions, staleTime: "static" });
}

function clientWithAnonymousFlags() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(featureFlagsQueryOptions.queryKey, { scanner: false });
  return client;
}

beforeEach(() => {
  fetchFlags.mockReset();
});

describe("refreshViewer", () => {
  it("replaces the cached flags so a static guard read sees the signed-in viewer's overrides", async () => {
    const client = clientWithAnonymousFlags();
    fetchFlags.mockResolvedValue({ scanner: true });

    await refreshViewer(client);

    await expect(readFlagsLikeAGuard(client)).resolves.toEqual({ scanner: true });
  });

  it("invalidates the session query", async () => {
    const client = clientWithAnonymousFlags();
    fetchFlags.mockResolvedValue({});
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    await refreshViewer(client);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sessionQueryOptions().queryKey });
  });

  it("keeps the previous flags and still resolves when the flag fetch fails", async () => {
    const client = clientWithAnonymousFlags();
    fetchFlags.mockRejectedValue(new Error("offline"));

    await expect(refreshViewer(client)).resolves.toBeUndefined();

    await expect(readFlagsLikeAGuard(client)).resolves.toEqual({ scanner: false });
  });
});

describe("refreshViewerAfterSignOut", () => {
  it("drops the previous viewer's overrides from the flags a static guard reads", async () => {
    const client = new QueryClient();
    client.setQueryData(featureFlagsQueryOptions.queryKey, { scanner: true });
    fetchFlags.mockResolvedValue({ scanner: false });

    await refreshViewerAfterSignOut(client, () => Promise.resolve());

    await expect(readFlagsLikeAGuard(client)).resolves.toEqual({ scanner: false });
  });

  it("navigates away before the session query flips", async () => {
    const client = new QueryClient();
    fetchFlags.mockResolvedValue({});
    const calls: string[] = [];
    vi.spyOn(client, "invalidateQueries").mockImplementation(() => {
      calls.push("invalidate-session");
      return Promise.resolve();
    });

    await refreshViewerAfterSignOut(client, () => {
      calls.push("leave");
      return Promise.resolve();
    });

    expect(calls).toEqual(["leave", "invalidate-session"]);
  });

  it("removes the signed-out viewer's queries and keeps public ones", async () => {
    const client = new QueryClient();
    fetchFlags.mockResolvedValue({});
    client.setQueryData(sessionQueryOptions().queryKey, { user: { id: "user-1" } } as never);
    client.setQueryData(["trades", "user-1"], []);
    client.setQueryData(["auth", "accounts"], []);
    client.setQueryData(["admin", "me", "user-1"], { isAdmin: true });
    client.setQueryData(["decks", "user-1", "store"], []);
    client.setQueryData(["catalog"], { cards: [] });
    client.setQueryData(["trades", "user-2"], []);
    vi.spyOn(client, "invalidateQueries").mockResolvedValue();

    await refreshViewerAfterSignOut(client, () => Promise.resolve());

    expect(client.getQueryData(["trades", "user-1"])).toBeUndefined();
    expect(client.getQueryData(["auth", "accounts"])).toBeUndefined();
    expect(client.getQueryData(["admin", "me", "user-1"])).toBeUndefined();
    expect(client.getQueryData(["decks", "user-1", "store"])).toEqual([]);
    expect(client.getQueryData(["catalog"])).toEqual({ cards: [] });
    expect(client.getQueryData(["trades", "user-2"])).toEqual([]);
    expect(client.getQueryData(featureFlagsQueryOptions.queryKey)).toEqual({});
  });

  it("removes the queries only after leaving the page", async () => {
    const client = new QueryClient();
    fetchFlags.mockResolvedValue({});
    client.setQueryData(sessionQueryOptions().queryKey, { user: { id: "user-1" } } as never);
    client.setQueryData(["trades", "user-1"], []);
    let seenWhileLeaving: unknown;

    await refreshViewerAfterSignOut(client, () => {
      seenWhileLeaving = client.getQueryData(["trades", "user-1"]);
      return Promise.resolve();
    });

    expect(seenWhileLeaving).toEqual([]);
    expect(client.getQueryData(["trades", "user-1"])).toBeUndefined();
  });
});

describe("isSignedOutViewerQuery", () => {
  it("matches a key that carries the user id at any depth", () => {
    expect(isSignedOutViewerQuery(["friend-groups", "user-1", "slug", "activity"], "user-1")).toBe(
      true,
    );
    expect(isSignedOutViewerQuery(["collectionValueHistory", "user-1", "cm"], "user-1")).toBe(true);
  });

  it("matches viewer-dependent families without a user id", () => {
    expect(isSignedOutViewerQuery(["tournaments", "submit", "token"], undefined)).toBe(true);
    expect(isSignedOutViewerQuery(["share-text", "deck", "d1"], undefined)).toBe(true);
    expect(isSignedOutViewerQuery(["user-share", "public", "token"], undefined)).toBe(true);
  });

  it("leaves the slots TanStack DB collections own", () => {
    expect(isSignedOutViewerQuery(["copies", "user-1", "store"], "user-1")).toBe(false);
    expect(isSignedOutViewerQuery(["decks", "user-1", "cards-store"], "user-1")).toBe(false);
  });

  it("leaves public and anonymous queries", () => {
    expect(isSignedOutViewerQuery(["meta", "decks"], "user-1")).toBe(false);
    expect(isSignedOutViewerQuery(["session"], "user-1")).toBe(false);
    expect(isSignedOutViewerQuery(["badges", ""], undefined)).toBe(false);
  });
});
