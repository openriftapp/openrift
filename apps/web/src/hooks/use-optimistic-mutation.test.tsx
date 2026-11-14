import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const reportMutationError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/query-client", () => ({ reportMutationError }));

const { useOptimisticMutation } = await import("./use-optimistic-mutation");

interface Lists {
  items: { id: string; hidden: boolean }[];
}

const KEY = ["lists", "user-1"] as const;

function setup(cached?: Lists) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (cached) {
    client.setQueryData(KEY, cached);
  }
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  const cancelSpy = vi.spyOn(client, "cancelQueries");
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, invalidateSpy, cancelSpy, wrapper: Wrapper };
}

function hide(cached: Lists, id: string): Lists {
  return { items: cached.items.map((item) => (item.id === id ? { ...item, hidden: true } : item)) };
}

describe("useOptimisticMutation", () => {
  it("applies the update before the request resolves", async () => {
    const { client, cancelSpy, wrapper } = setup({ items: [{ id: "a", hidden: false }] });
    let finish: () => void = () => {};
    const mutationFn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(
      () => useOptimisticMutation<Lists, string>({ queryKey: KEY, mutationFn, apply: hide }),
      { wrapper },
    );

    let pending: Promise<unknown> = Promise.resolve();
    await act(async () => {
      pending = result.current.mutateAsync("a");
      await Promise.resolve();
    });

    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: KEY });
    expect(client.getQueryData(KEY)).toEqual({ items: [{ id: "a", hidden: true }] });

    await act(async () => {
      finish();
      await pending;
    });
  });

  it("refetches the key and every extra key once it settles", async () => {
    const { invalidateSpy, wrapper } = setup({ items: [] });
    const { result } = renderHook(
      () =>
        useOptimisticMutation<Lists, string>({
          queryKey: KEY,
          mutationFn: () => Promise.resolve(),
          apply: hide,
          invalidates: [["copies", "user-1"]],
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync("a");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [...KEY] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["copies", "user-1"] });
  });

  it("rolls back and reports when the request fails", async () => {
    const original = { items: [{ id: "a", hidden: false }] };
    const { client, invalidateSpy, wrapper } = setup(original);
    const failure = new Error("Server unreachable");
    const { result } = renderHook(
      () =>
        useOptimisticMutation<Lists, string>({
          queryKey: KEY,
          mutationFn: () => Promise.reject(failure),
          apply: hide,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync("a").catch(() => {});
    });

    expect(client.getQueryData(KEY)).toEqual(original);
    expect(reportMutationError).toHaveBeenCalledWith(failure, client);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [...KEY] });
  });

  it("derives the key and the extra keys from the variables", async () => {
    const original = { items: [{ id: "a", hidden: false }] };
    const { client, invalidateSpy, wrapper } = setup(original);
    let fail: (error: Error) => void = () => {};
    const { result } = renderHook(
      () =>
        useOptimisticMutation<Lists, { user: string; id: string }>({
          queryKey: (vars) => ["lists", vars.user],
          mutationFn: (vars) =>
            vars.user === "user-2"
              ? new Promise<void>((_resolve, reject) => {
                  fail = reject;
                })
              : Promise.resolve(),
          apply: (cached, vars) => hide(cached, vars.id),
          invalidates: (vars) => [["copies", vars.user]],
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ user: "user-1", id: "a" });
    });

    expect(client.getQueryData(KEY)).toEqual({ items: [{ id: "a", hidden: true }] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["lists", "user-1"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["copies", "user-1"] });

    const otherKey = ["lists", "user-2"];
    const otherOriginal = { items: [{ id: "b", hidden: false }] };
    client.setQueryData(otherKey, otherOriginal);
    let pending: Promise<unknown> = Promise.resolve();
    await act(async () => {
      pending = result.current.mutateAsync({ user: "user-2", id: "b" });
      await Promise.resolve();
    });

    expect(client.getQueryData(otherKey)).toEqual({ items: [{ id: "b", hidden: true }] });

    await act(async () => {
      fail(new Error("Server unreachable"));
      await expect(pending).rejects.toThrow("Server unreachable");
    });

    expect(client.getQueryData(otherKey)).toEqual(otherOriginal);
    expect(client.getQueryData(KEY)).toEqual({ items: [{ id: "a", hidden: true }] });
  });

  it("skips the optimistic write when nothing is cached", async () => {
    const { client, wrapper } = setup();
    const apply = vi.fn(hide);
    const { result } = renderHook(
      () =>
        useOptimisticMutation<Lists, string>({
          queryKey: KEY,
          mutationFn: () => Promise.resolve(),
          apply,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync("a");
    });

    expect(apply).not.toHaveBeenCalled();
    expect(client.getQueryData(KEY)).toBeUndefined();
  });
});
