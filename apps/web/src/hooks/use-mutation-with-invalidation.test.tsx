import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useMutationWithInvalidation } from "./use-mutation-with-invalidation";

function makeClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  return { client, invalidateSpy };
}

function wrap(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useMutationWithInvalidation", () => {
  it("invalidates a static list of keys on success", async () => {
    const { client, invalidateSpy } = makeClient();

    const { result } = renderHook(
      () =>
        useMutationWithInvalidation({
          mutationFn: async () => "done",
          invalidates: [["a"], ["b", "c"]],
        }),
      { wrapper: wrap(client) },
    );

    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["a"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["b", "c"] });
  });

  it("derives keys from the mutation variables when `invalidates` is a function", async () => {
    const { client, invalidateSpy } = makeClient();

    const { result } = renderHook(
      () =>
        useMutationWithInvalidation<string, { id: string }>({
          mutationFn: async ({ id }) => `ok:${id}`,
          invalidates: (variables) => [["item", variables.id]],
        }),
      { wrapper: wrap(client) },
    );

    await act(async () => {
      await result.current.mutateAsync({ id: "xyz" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["item", "xyz"] });
  });

  it("passes the mutation response to the `invalidates` function", async () => {
    const { client, invalidateSpy } = makeClient();

    const { result } = renderHook(
      () =>
        useMutationWithInvalidation<{ slug: string }, void>({
          mutationFn: async () => ({ slug: "from-server" }),
          invalidates: (_variables, data) => [["item", data.slug]],
        }),
      { wrapper: wrap(client) },
    );

    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["item", "from-server"] });
  });

  it("does not invalidate when the mutation fails", async () => {
    const { client, invalidateSpy } = makeClient();

    const { result } = renderHook(
      () =>
        useMutationWithInvalidation({
          mutationFn: async () => {
            throw new Error("nope");
          },
          invalidates: [["a"]],
        }),
      { wrapper: wrap(client) },
    );

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow("nope");
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("stays pending until the refetch of an observed invalidated query lands", async () => {
    const { client } = makeClient();
    let fetches = 0;
    let releaseRefetch = () => {};

    const { result } = renderHook(
      () => {
        const query = useQuery({
          queryKey: ["a"],
          queryFn: () => {
            fetches += 1;
            if (fetches === 1) {
              return "initial";
            }
            return new Promise<string>((resolve) => {
              releaseRefetch = () => resolve("fresh");
            });
          },
        });
        const mutation = useMutationWithInvalidation({
          mutationFn: async () => "done",
          invalidates: [["a"]],
        });
        return { query, mutation };
      },
      { wrapper: wrap(client) },
    );

    await waitFor(() => expect(result.current.query.data).toBe("initial"));

    let settled = false;
    let mutation: Promise<string> = Promise.resolve("");
    act(() => {
      mutation = result.current.mutation.mutateAsync().then((value) => {
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
    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true));
    expect(result.current.query.data).toBe("fresh");
  });

  it("stays successful when an invalidated query fails to refetch", async () => {
    const { client } = makeClient();
    let fetches = 0;

    const { result } = renderHook(
      () => {
        const query = useQuery({
          queryKey: ["a"],
          queryFn: () => {
            fetches += 1;
            if (fetches === 1) {
              return "initial";
            }
            throw new Error("refetch failed");
          },
        });
        const mutation = useMutationWithInvalidation({
          mutationFn: async () => "done",
          invalidates: [["a"]],
        });
        return { query, mutation };
      },
      { wrapper: wrap(client) },
    );

    await waitFor(() => expect(result.current.query.data).toBe("initial"));

    await act(async () => {
      await expect(result.current.mutation.mutateAsync()).resolves.toBe("done");
    });

    expect(fetches).toBe(2);
    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true));
  });

  it("runs the caller's onSettled after the invalidations have settled", async () => {
    const { client } = makeClient();
    const onSettled = vi.fn();
    let fetches = 0;
    let releaseRefetch = () => {};

    const { result } = renderHook(
      () => {
        useQuery({
          queryKey: ["a"],
          queryFn: () => {
            fetches += 1;
            if (fetches === 1) {
              return "initial";
            }
            return new Promise<string>((resolve) => {
              releaseRefetch = () => resolve("fresh");
            });
          },
        });
        return useMutationWithInvalidation({
          mutationFn: async () => "done",
          invalidates: [["a"]],
          onSettled,
        });
      },
      { wrapper: wrap(client) },
    );

    await waitFor(() => expect(fetches).toBe(1));

    let mutation: Promise<string> = Promise.resolve("");
    act(() => {
      mutation = result.current.mutateAsync();
    });

    await waitFor(() => expect(fetches).toBe(2));
    expect(onSettled).not.toHaveBeenCalled();

    await act(async () => {
      releaseRefetch();
      await mutation;
    });

    expect(onSettled).toHaveBeenCalledOnce();
  });
});
