import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
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

  it("refetches once, after the last of overlapping writes to the same key", async () => {
    const { invalidateSpy, wrapper } = setup({
      items: [
        { id: "a", hidden: false },
        { id: "b", hidden: false },
      ],
    });
    const finishers: (() => void)[] = [];
    const mutationFn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishers.push(resolve);
        }),
    );
    const { result } = renderHook(
      () =>
        useOptimisticMutation<Lists, string>({
          mutationKey: ["lists", "hide"],
          queryKey: KEY,
          mutationFn,
          apply: hide,
          pendingWrites: (mutationCache) =>
            mutationCache.findAll({ mutationKey: ["lists", "hide"], status: "pending" }).length,
        }),
      { wrapper },
    );

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    await act(async () => {
      first = result.current.mutateAsync("a");
      second = result.current.mutateAsync("b");
      await Promise.resolve();
    });
    await waitFor(() => expect(finishers).toHaveLength(2));

    await act(async () => {
      finishers[0]!();
      await first;
    });
    expect(invalidateSpy).not.toHaveBeenCalled();

    await act(async () => {
      finishers[1]!();
      await second;
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [...KEY] });
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

  it("undoes only its own change through rollback, keeping a second write's change", async () => {
    const original = {
      items: [
        { id: "a", hidden: false },
        { id: "b", hidden: false },
      ],
    };
    const { client, wrapper } = setup(original);
    let fail: (error: Error) => void = () => {};
    const rollback = vi.fn((cached: Lists, id: string, previous: Lists) => ({
      items: cached.items.map((item) =>
        item.id === id ? (previous.items.find((old) => old.id === id) ?? item) : item,
      ),
    }));
    const { result } = renderHook(
      () =>
        useOptimisticMutation<Lists, string>({
          queryKey: KEY,
          mutationFn: (id) =>
            id === "a"
              ? new Promise<void>((_resolve, reject) => {
                  fail = reject;
                })
              : new Promise<void>(() => {}),
          apply: hide,
          rollback,
        }),
      { wrapper },
    );

    let failing: Promise<unknown> = Promise.resolve();
    await act(async () => {
      failing = result.current.mutateAsync("a");
      await Promise.resolve();
    });
    await act(async () => {
      void result.current.mutateAsync("b");
      await Promise.resolve();
    });
    await act(async () => {
      fail(new Error("Server unreachable"));
      await expect(failing).rejects.toThrow("Server unreachable");
    });

    expect(rollback).toHaveBeenCalledOnce();
    expect(client.getQueryData(KEY)).toEqual({
      items: [
        { id: "a", hidden: false },
        { id: "b", hidden: true },
      ],
    });
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

  it("stays pending until the refetch of an observed key lands", async () => {
    const { client, wrapper } = setup();
    let fetches = 0;
    let releaseRefetch = () => {};
    const { result } = renderHook(
      () => {
        const query = useQuery({
          queryKey: KEY,
          queryFn: () => {
            fetches += 1;
            if (fetches === 1) {
              return { items: [{ id: "a", hidden: false }] };
            }
            return new Promise<Lists>((resolve) => {
              releaseRefetch = () => resolve({ items: [{ id: "a", hidden: true }] });
            });
          },
        });
        const mutation = useOptimisticMutation<Lists, string>({
          queryKey: KEY,
          mutationFn: () => Promise.resolve(),
          apply: hide,
        });
        return { query, mutation };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.query.data).toBeDefined());

    let settled = false;
    let mutation: Promise<unknown> = Promise.resolve();
    act(() => {
      mutation = result.current.mutation.mutateAsync("a").then((value) => {
        settled = true;
        return value;
      });
    });

    await waitFor(() => expect(fetches).toBe(2));
    expect(result.current.mutation.isPending).toBe(true);
    expect(settled).toBe(false);

    await act(async () => {
      releaseRefetch();
      await mutation;
    });
    expect(settled).toBe(true);
    expect(client.getQueryData(KEY)).toEqual({ items: [{ id: "a", hidden: true }] });
  });

  it("stays successful when the refetch fails", async () => {
    const { wrapper } = setup();
    let fetches = 0;
    const { result } = renderHook(
      () => {
        const query = useQuery({
          queryKey: KEY,
          queryFn: (): Lists => {
            fetches += 1;
            if (fetches === 1) {
              return { items: [{ id: "a", hidden: false }] };
            }
            throw new Error("refetch failed");
          },
        });
        const mutation = useOptimisticMutation<Lists, string>({
          queryKey: KEY,
          mutationFn: () => Promise.resolve("done"),
          apply: hide,
        });
        return { query, mutation };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.query.data).toBeDefined());

    await act(async () => {
      await expect(result.current.mutation.mutateAsync("a")).resolves.toBe("done");
    });
    expect(fetches).toBe(2);
    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true));
  });

  it("hands a call's signal to mutationFn and its plain variables to apply and the key", async () => {
    const { client, wrapper } = setup({ items: [{ id: "a", hidden: false }] });
    const mutationFn = vi.fn(async (_id: string, _signal?: AbortSignal) => {});
    const queryKey = vi.fn((_id: string) => KEY);
    const { signal } = new AbortController();
    const { result } = renderHook(
      () => useOptimisticMutation<Lists, string>({ queryKey, mutationFn, apply: hide }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync("a", { signal });
    });

    expect(mutationFn).toHaveBeenCalledWith("a", signal);
    expect(queryKey).toHaveBeenCalledWith("a");
    expect(queryKey.mock.calls.every(([id]) => id === "a")).toBe(true);
    expect(client.getQueryData(KEY)).toEqual({ items: [{ id: "a", hidden: true }] });
  });
});
