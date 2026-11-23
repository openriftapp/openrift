import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  respond: null as null | (() => Promise<void>),
}));

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler: () => async () => {
        if (server.respond !== null) {
          return server.respond();
        }
        throw new Error("Could not rehost the image: HTTP 404");
      },
      middleware: () => chain,
      validator: () => chain,
    };
    return chain;
  },
  createMiddleware: () => {
    const chain = { server: () => chain };
    return chain;
  },
}));

vi.mock("@/lib/server-fns/with-cookies", () => ({
  withCookies: () => {},
}));

const { reportMutationError } = vi.hoisted(() => ({ reportMutationError: vi.fn() }));
vi.mock("@/lib/query-client", () => ({ reportMutationError }));

const {
  useActivatePrintingImage,
  useEnsurePrintingImageOriginal,
  useImageEditPending,
  useRehostPrintingImage,
  useRotatePrintingImage,
  useSetPrintingImageNeedsLevels,
  useSetPrintingImageNeedsTrim,
  useSetPrintingImageQuad,
} = await import("./use-admin-image-mutations");
const { useRefetchImages } = await import("./use-rehost");
const { adminKeys } = await import("@/features/admin/lib/admin-query-keys");
const { cardsKeys, catalogKeys, promosKeys } =
  await import("@/features/cards/lib/cards-query-keys");

afterEach(() => {
  server.respond = null;
});

function wrap(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const SCOPE = [["admin", "cards"]] as const;

describe("image mutations that can fail after changing the image", () => {
  it("reports a failed activation and still refreshes the image list", async () => {
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useActivatePrintingImage(SCOPE), {
      wrapper: wrap(client),
    });

    act(() => {
      result.current.mutate({ imageId: "img-1", active: true });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(reportMutationError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Could not rehost the image: HTTP 404" }),
      client,
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "cards"] });
  });

  it("reports a failed rehost and still refreshes the image list", async () => {
    reportMutationError.mockClear();
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRehostPrintingImage(), { wrapper: wrap(client) });

    act(() => {
      result.current.mutate("img-1");
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(reportMutationError).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [...adminKeys.cards.all] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [...catalogKeys.all] });
  });
});

describe("useEnsurePrintingImageOriginal", () => {
  it("leaves a failure to the straighten dialog's inline status", async () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useEnsurePrintingImageOriginal(), {
      wrapper: wrap(client),
    });

    act(() => {
      result.current.mutate("img-1");
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getMutationCache().getAll()[0]?.options.meta).toEqual({ inlineError: true });
  });
});

describe("image file edits", () => {
  const editors = {
    rotate: () => {
      const { result } = renderHook(() => useRotatePrintingImage(), { wrapper: wrap(client) });
      return () => result.current.mutateAsync({ imageId: "img-1", rotation: 90 });
    },
    trim: () => {
      const { result } = renderHook(() => useSetPrintingImageNeedsTrim(), {
        wrapper: wrap(client),
      });
      return () => result.current.mutateAsync({ imageId: "img-1", needsTrim: true });
    },
    contrast: () => {
      const { result } = renderHook(() => useSetPrintingImageNeedsLevels(), {
        wrapper: wrap(client),
      });
      return () => result.current.mutateAsync({ imageId: "img-1", needsLevels: true });
    },
    straighten: () => {
      const { result } = renderHook(() => useSetPrintingImageQuad(), { wrapper: wrap(client) });
      return () => result.current.mutateAsync({ imageId: "img-1", quad: null });
    },
    rehost: () => {
      const { result } = renderHook(() => useRehostPrintingImage(), { wrapper: wrap(client) });
      return () => result.current.mutateAsync("img-1");
    },
    refetch: () => {
      const { result } = renderHook(() => useRefetchImages(), { wrapper: wrap(client) });
      return async () => {
        await result.current.mutateAsync(["file-1"]);
      };
    },
  };
  let client: QueryClient;

  it.each(Object.keys(editors) as (keyof typeof editors)[])(
    "%s refreshes every cached view that can show the old image file",
    async (edit) => {
      server.respond = async () => {};
      client = new QueryClient();
      const queries = [
        adminKeys.cards.detail("other-card-sharing-the-face"),
        adminKeys.cards.list,
        adminKeys.printingDesk.printing("printing-1"),
        adminKeys.workspaceQueue,
        adminKeys.workspaceRecords.infinite({ kind: "face" }),
        catalogKeys.all,
        cardsKeys.detail("jinx-loose-cannon"),
        promosKeys.forLanguage("EN"),
      ];
      for (const key of queries) {
        client.setQueryData([...key], { stale: false });
      }

      const run = editors[edit]();
      await act(() => run());

      for (const key of queries) {
        expect(client.getQueryState([...key])?.isInvalidated, JSON.stringify(key)).toBe(true);
      }
    },
  );

  it("marks only the edited image busy until its edit settles", async () => {
    let finish = () => {};
    server.respond = () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      });
    client = new QueryClient();
    const run = editors.rotate();
    const edited = renderHook(() => useImageEditPending("img-1"), { wrapper: wrap(client) });
    const other = renderHook(() => useImageEditPending("img-2"), { wrapper: wrap(client) });

    let done: Promise<unknown> = Promise.resolve();
    act(() => {
      done = run();
    });

    await waitFor(() => expect(edited.result.current).toBe(true));
    expect(other.result.current).toBe(false);
    await act(async () => {
      finish();
      await done;
    });
    await waitFor(() => expect(edited.result.current).toBe(false));
  });
});
