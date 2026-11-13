import type { QueryClient } from "@tanstack/react-query";
import type { ParsedLocation } from "@tanstack/react-router";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { notFoundError } from "@/lib/server-fns/api-error";

import { ensureFriendGroupDetailCanonical } from "./friend-groups-queries";

function fakeQueryClient(canonicalSlug: string): QueryClient {
  return {
    query: vi.fn(() => Promise.resolve({ group: { slug: canonicalSlug } })),
  } as unknown as QueryClient;
}

const location = { href: "/groups/old-slug/trades?filter=open" } as ParsedLocation;

describe("ensureFriendGroupDetailCanonical", () => {
  it("returns the detail when the requested slug is canonical", async () => {
    const detail = await ensureFriendGroupDetailCanonical({
      queryClient: fakeQueryClient("old-slug"),
      userId: "user-1",
      slug: "old-slug",
      location,
    });
    expect(detail.group.slug).toBe("old-slug");
  });

  it("redirects to the canonical slug, preserving sub-path and search", async () => {
    let thrown: unknown;
    try {
      await ensureFriendGroupDetailCanonical({
        queryClient: fakeQueryClient("new-slug"),
        userId: "user-1",
        slug: "old-slug",
        location,
      });
    } catch (error) {
      thrown = error;
    }
    expect(isRedirect(thrown)).toBe(true);
    const redirectError = thrown as { options: { href?: string; replace?: boolean } };
    expect(redirectError.options.href).toBe("/groups/new-slug/trades?filter=open");
    expect(redirectError.options.replace).toBe(true);
  });

  it("shows the not-found page for a group the viewer cannot see", async () => {
    const queryClient = {
      query: vi.fn(() => Promise.reject(notFoundError())),
    } as unknown as QueryClient;

    const thrown = await ensureFriendGroupDetailCanonical({
      queryClient,
      userId: "user-1",
      slug: "old-slug",
      location,
    }).catch((error: unknown) => error);

    expect(isNotFound(thrown)).toBe(true);
  });

  it("reports the group's failure before a failure of the query alongside it", async () => {
    const queryClient = {
      query: vi.fn(() => Promise.reject(notFoundError())),
    } as unknown as QueryClient;

    const thrown = await ensureFriendGroupDetailCanonical({
      queryClient,
      userId: "user-1",
      slug: "old-slug",
      location,
      alongside: Promise.reject(new Error("Boom")),
    }).catch((error: unknown) => error);

    expect(isNotFound(thrown)).toBe(true);
  });

  it("redirects a renamed group before reporting the query alongside it", async () => {
    const thrown = await ensureFriendGroupDetailCanonical({
      queryClient: fakeQueryClient("new-slug"),
      userId: "user-1",
      slug: "old-slug",
      location,
      alongside: Promise.reject(new Error("Boom")),
    }).catch((error: unknown) => error);

    expect(isRedirect(thrown)).toBe(true);
  });

  it("rethrows a failure of the query alongside a group that resolved", async () => {
    const failure = new Error("Boom");

    await expect(
      ensureFriendGroupDetailCanonical({
        queryClient: fakeQueryClient("old-slug"),
        userId: "user-1",
        slug: "old-slug",
        location,
        alongside: Promise.reject(failure),
      }),
    ).rejects.toBe(failure);
  });
});
