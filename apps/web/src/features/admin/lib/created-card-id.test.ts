import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const detail = vi.hoisted(() => ({ current: (): Promise<unknown> => Promise.resolve(null) }));

vi.mock("@/features/admin/lib/admin-card-queries", () => ({
  adminCardDetailQueryOptions: (cardSlug: string) => ({
    queryKey: ["admin", "cards", "detail", cardSlug],
    queryFn: () => detail.current(),
  }),
}));

const { readCreatedCardId } = await import("./created-card-id");

describe("readCreatedCardId", () => {
  it("returns the new card's id", async () => {
    detail.current = () => Promise.resolve({ card: { id: "card-uuid" } });

    expect(await readCreatedCardId(new QueryClient(), "ekko")).toEqual({
      ok: true,
      id: "card-uuid",
    });
  });

  it("carries the read's own error", async () => {
    detail.current = () =>
      Promise.reject(Object.assign(new Error("Card not found"), { status: 404 }));

    const result = await readCreatedCardId(
      new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      "ekko",
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.reason).toContain("Card not found");
  });

  it("says the card could not be read back when the detail has no card", async () => {
    detail.current = () => Promise.resolve({ card: null });

    expect(await readCreatedCardId(new QueryClient(), "ekko")).toEqual({
      ok: false,
      reason: "the new card could not be read back",
    });
  });
});
